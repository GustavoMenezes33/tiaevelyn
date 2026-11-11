import type { MemoryManager, StudentContext } from '../memory/MemoryManager.js';
import type { SkillLoader } from '../skills/SkillLoader.js';
import type { SkillMetadata } from '../skills/SkillLoader.js';
import type { SkillRouter } from '../skills/SkillRouter.js';
import type { CefrLevel, StudentProfile } from '../memory/StudentProfileRepository.js';
import type { SkillExecutor } from '../skills/SkillExecutor.js';
import type { ToolExecutionContext } from '../tools/BaseTool.js';
import type { ChatMessage } from '../llm/ILlmProvider.js';
import { LlmProviderError } from '../llm/ILlmProvider.js';
import { MaxIterationsError } from './AgentLoop.js';
import type { FileTagExtractor } from './FileTagExtractor.js';
import type { AgentInput, AgentOutput } from './types.js';
import { Logger } from '../utils/Logger.js';

/**
 * Facade do core: recebe a entrada normalizada e orquestra
 * Memória -> SkillLoader -> SkillRouter -> SkillExecutor/AgentLoop -> Memória.
 */
export class AgentController {
  private readonly logger = new Logger('AgentController');

  constructor(
    private readonly memory: MemoryManager,
    private readonly skillLoader: SkillLoader,
    private readonly skillRouter: SkillRouter,
    private readonly skillExecutor: SkillExecutor,
    private readonly fileTags: FileTagExtractor,
  ) {}

  async handle(input: AgentInput): Promise<AgentOutput> {
    const conversationId = this.memory.getActiveConversationId(input.userId);
    this.memory.save(conversationId, 'user', input.text);

    const base = { isAudio: input.requiresAudioReply, voiceId: input.voiceId };
    const context: ToolExecutionContext = { userId: input.userId, conversationId, files: [] };

    try {
      // Hot-reload: as skills são relidas do disco a cada requisição.
      const availableSkills = this.skillLoader.loadAll();
      const history = this.memory.getContext(conversationId);
      const skill = await this.chooseSkill(input, availableSkills, history);

      const result = await this.skillExecutor.execute({
        skill,
        availableSkills,
        history,
        context,
        audioReply: input.requiresAudioReply,
        studentName: input.userName,
        student: this.memory.getStudentContext(input.userId),
      });

      this.memory.saveToolTraces(conversationId, result.toolTraces);
      this.memory.save(conversationId, 'assistant', result.answer);
      // A skill terminou com perguntas/exercícios: na próxima mensagem o roteador sabe que pode ser a resposta.
      if (skill?.expectsReply) this.memory.setPendingSkill(input.userId, skill.name);
      const { text, files } = this.fileTags.extract(result.answer);
      return { ...base, text, files: [...context.files, ...files], isError: false };
    } catch (err) {
      // Mesmo sem resposta final, as ferramentas já rodaram (ex.: um arquivo já foi criado).
      if (err instanceof MaxIterationsError) this.memory.saveToolTraces(conversationId, err.toolTraces);
      return { ...base, text: this.describeError(err), files: context.files, isAudio: false, isError: true };
    }
  }

  /** Inicia uma conversa nova para o usuário (comando /nova). */
  resetConversation(userId: string): void {
    this.memory.startNewConversation(userId);
  }

  getStudentContext(userId: string): StudentContext {
    return this.memory.getStudentContext(userId);
  }

  /** Nível definido pelo próprio aluno (comando /nivel B2). */
  setStudentLevel(userId: string, level: CefrLevel): StudentProfile {
    return this.memory.updateProfile(userId, { level, levelSource: 'manual' });
  }

  /**
   * Skill forçada por comando tem prioridade. Senão decide o roteador; se a última resposta
   * fez perguntas por uma skill, ele recebe essa dica para reconhecer respostas curtas ("1. went 2. ...").
   */
  private async chooseSkill(
    input: AgentInput,
    available: SkillMetadata[],
    history: ChatMessage[],
  ): Promise<SkillMetadata | null> {
    const pendingName = this.memory.takePendingSkill(input.userId);
    if (input.forceSkill) {
      const forced = available.find((s) => s.name === input.forceSkill);
      if (forced) return forced;
      this.logger.warn(`Skill "${input.forceSkill}" não está instalada; seguindo pelo roteador.`);
    }

    const pending = available.find((s) => s.name === pendingName);
    // O histórico já inclui a mensagem atual; a resposta anterior da Tia Evelyn é a última "assistant".
    const lastReply = [...history].reverse().find((m) => m.role === 'assistant')?.content ?? '';
    return this.skillRouter.route(input.text, available, pending ? { skill: pending, lastReply } : undefined);
  }

  /** Converte erros internos em mensagens seguras (sem stack nem chaves). */
  private describeError(err: unknown): string {
    if (err instanceof MaxIterationsError) {
      this.logger.warn(err.message);
      return `Desculpe, desisti do processamento: não cheguei a uma resposta em ${err.limit} iterações.`;
    }
    if (err instanceof LlmProviderError) {
      this.logger.error(err.message);
      return `API Provider ${err.provider} falhou. Tente novamente em instantes.`;
    }
    this.logger.error('Erro inesperado no pipeline.', err);
    return 'Ocorreu um erro inesperado ao processar sua mensagem.';
  }
}
