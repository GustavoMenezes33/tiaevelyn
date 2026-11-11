import { ConversationRepository } from './ConversationRepository.js';
import { MessageRepository, type StoredRole } from './MessageRepository.js';
import type { Database } from './Database.js';
import type { ChatMessage } from '../llm/ILlmProvider.js';
import type { ToolTrace } from '../core/AgentLoop.js';
import { StudentProfileRepository, type ProfilePatch, type StudentProfile } from './StudentProfileRepository.js';
import { VocabularyRepository, type VocabularyItem } from './VocabularyRepository.js';
import { Logger } from '../utils/Logger.js';

/** Limite de caracteres por mensagem persistida (EC-03). */
const MAX_CONTENT_CHARS = 100_000;
/** Os argumentos de uma ferramenta podem trazer um arquivo inteiro; no registro basta o começo. */
const MAX_TOOL_FIELD_CHARS = 500;
/** Uma skill esperando resposta (ex.: teste de nivelamento) expira depois deste tempo. */
const PENDING_SKILL_TTL_MS = 24 * 60 * 60 * 1000;
/** Quantos termos recentes do vocabulário entram no prompt (para não repetir palavras já ensinadas). */
const RECENT_TERMS_IN_PROMPT = 30;

/** O que o prompt precisa saber do aluno a cada resposta. */
export interface StudentContext {
  profile: StudentProfile | null;
  vocabularyCount: number;
  recentTerms: string[];
}

interface StoredToolCall {
  name: string;
  arguments: string;
  result: string;
}

/**
 * Facade da memória: esconde os repositórios e entrega ao AgentLoop
 * apenas a janela recente (`MEMORY_WINDOW_SIZE`) da conversa.
 */
export class MemoryManager {
  private readonly logger = new Logger('MemoryManager');
  private readonly conversations: ConversationRepository;
  private readonly messages: MessageRepository;
  private readonly profiles: StudentProfileRepository;
  private readonly vocabulary: VocabularyRepository;

  constructor(
    database: Database,
    private readonly windowSize: number,
    private readonly providerName: string,
  ) {
    this.conversations = new ConversationRepository(database.connection);
    this.messages = new MessageRepository(database.connection);
    this.profiles = new StudentProfileRepository(database.connection);
    this.vocabulary = new VocabularyRepository(database.connection);
  }

  /** Retorna o ID da conversa ativa do usuário, criando uma se necessário. */
  getActiveConversationId(userId: string): string {
    const active = this.conversations.findActiveByUser(userId);
    return (active ?? this.conversations.create(userId, this.providerName)).id;
  }

  /** Encerra a conversa atual; a próxima mensagem usa uma nova (o histórico antigo continua salvo). */
  startNewConversation(userId: string): string {
    this.conversations.deactivateAllForUser(userId);
    this.profiles.setPendingSkill(userId, null);
    return this.conversations.create(userId, this.providerName).id;
  }

  save(conversationId: string, role: StoredRole, content: string): void {
    try {
      this.messages.insert(conversationId, role, MemoryManager.sanitize(content));
    } catch (err) {
      // EC-02 (PRD): banco ocupado além do timeout -> descarta de forma soft.
      this.logger.error(`Falha ao persistir mensagem (${role}).`, err);
    }
  }

  getProfile(userId: string): StudentProfile | null {
    return this.profiles.find(userId);
  }

  updateProfile(userId: string, patch: ProfilePatch): StudentProfile {
    this.profiles.update(userId, patch);
    return this.profiles.find(userId)!;
  }

  getStudentContext(userId: string): StudentContext {
    return {
      profile: this.profiles.find(userId),
      vocabularyCount: this.vocabulary.count(userId),
      recentTerms: this.vocabulary.recentTerms(userId, RECENT_TERMS_IN_PROMPT),
    };
  }

  /** Registra termos no vocabulário do aluno; retorna quantos eram novos. */
  addVocabulary(userId: string, items: VocabularyItem[], source: string): number {
    return this.vocabulary.add(userId, items, source);
  }

  countVocabulary(userId: string): number {
    return this.vocabulary.count(userId);
  }

  /** Marca que a última resposta fez perguntas por esta skill (dica para o roteador na próxima mensagem). */
  setPendingSkill(userId: string, skillName: string): void {
    this.profiles.setPendingSkill(userId, skillName);
  }

  /** Retorna e limpa a skill pendente (vale para a próxima mensagem, e só se não tiver expirado). */
  takePendingSkill(userId: string): string | null {
    const profile = this.profiles.find(userId);
    if (!profile?.pendingSkill) return null;
    this.profiles.setPendingSkill(userId, null);
    const age = Date.now() - Date.parse(profile.pendingSince ?? '');
    return age >= 0 && age <= PENDING_SKILL_TTL_MS ? profile.pendingSkill : null;
  }

  /** Persiste as ferramentas executadas numa resposta, como mensagens role "tool". */
  saveToolTraces(conversationId: string, traces: ToolTrace[]): void {
    for (const trace of traces) {
      const record: StoredToolCall = {
        name: trace.name,
        arguments: MemoryManager.clip(trace.arguments),
        result: MemoryManager.clip(trace.observation),
      };
      this.save(conversationId, 'tool', JSON.stringify(record));
    }
  }

  /**
   * Histórico recente (user/assistant) no formato aceito pelos provedores de LLM.
   * As ferramentas usadas em cada resposta entram como uma nota no início dela, já que
   * os provedores exigem que mensagens "tool" venham pareadas com a chamada original.
   */
  getContext(conversationId: string): ChatMessage[] {
    const window = this.messages.findRecent(conversationId, this.windowSize, ['user', 'assistant']);
    if (window.length === 0) return [];

    const tools = this.messages.findSince(conversationId, 'tool', window[0]!.id);
    let next = 0;
    return window.map((m) => {
      if (m.role !== 'assistant') return { role: 'user', content: m.content };
      const used: string[] = [];
      while (next < tools.length && tools[next]!.id < m.id) {
        used.push(MemoryManager.describeTool(tools[next++]!.content));
      }
      const note = used.length ? `[registro interno: ferramentas usadas nesta resposta: ${used.join('; ')}]\n\n` : '';
      return { role: 'assistant', content: note + m.content };
    });
  }

  private static describeTool(content: string): string {
    try {
      const call = JSON.parse(content) as StoredToolCall;
      return `${call.name}(${call.arguments}) -> ${call.result}`;
    } catch {
      return content;
    }
  }

  private static clip(text: string): string {
    const flat = text.replace(/\s+/g, ' ').trim();
    return flat.length > MAX_TOOL_FIELD_CHARS ? `${flat.slice(0, MAX_TOOL_FIELD_CHARS)}…` : flat;
  }

  private static sanitize(content: string): string {
    const clean = content.replace(/\u0000/g, '');
    return clean.length > MAX_CONTENT_CHARS ? `${clean.slice(0, MAX_CONTENT_CHARS)}\n…[truncado]` : clean;
  }
}
