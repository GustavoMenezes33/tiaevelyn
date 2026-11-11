import path from 'node:path';
import type { Context } from 'grammy';
import type { AgentController } from '../core/AgentController.js';
import type { AgentInput, InputSource } from '../core/types.js';
import type { TempFiles } from '../utils/TempFiles.js';
import type { TelegramOutputHandler } from './TelegramOutputHandler.js';
import { ChatActionKeeper } from './ChatActionKeeper.js';
import { TelegramFileDownloader } from './input/TelegramFileDownloader.js';
import { DocumentHandler, MAX_DOCUMENT_BYTES } from './input/DocumentHandler.js';
import type { WhisperTranscriber } from './input/WhisperTranscriber.js';
import { UserFacingError } from './UserFacingError.js';
import { KeyedQueue } from '../utils/KeyedQueue.js';
import { CEFR_LEVELS, type CefrLevel } from '../memory/StudentProfileRepository.js';
import type { StudentContext } from '../memory/MemoryManager.js';
import { Logger } from '../utils/Logger.js';

/** Skill aplicada pelo comando /nivelamento. */
const PLACEMENT_SKILL = 'placement-test';
const LEVEL_SOURCES = { nivelamento: 'teste de nivelamento', observacao: 'percebido nas conversas', manual: 'definido por você' };

const UNSUPPORTED_MESSAGE = '⚠️ No momento, só consigo processar texto, documentos (.md e .pdf) e áudio.';

/** Palavra inteira com suporte a acentos (o `\b` do JS só entende ASCII). */
const word = (alternatives: string): string => `(?<!\\p{L})(?:${alternatives})(?!\\p{L})`;
/** Pedidos explícitos de resposta em áudio ("me responde em áudio", "fale comigo", "reply in voice"). */
const AUDIO_REQUEST = new RegExp(
  `${word('respond[ae]r?|fal[ae]|manda|envi[ae]')}[^.?!]{0,30}${word('em|por|com')}\\s+${word('áudio|audio|voz')}` +
    `|${word('fale comigo')}` +
    `|${word('reply|answer|respond')}[^.?!]{0,20}${word('in|with')}\\s+${word('audio|voice')}`,
  'iu',
);
/** Negações ("sem ser em áudio", "não responda em áudio"). */
const AUDIO_NEGATION = new RegExp(
  `${word("sem|não|nao|without|don'?t|do not")}[^.?!]{0,25}${word('áudio|audio|voz|voice')}`,
  'iu',
);

/**
 * Converte eventos do Telegram (texto, documento, voz) em `AgentInput`
 * e repassa ao AgentController; a resposta segue para o OutputHandler.
 */
export class TelegramInputHandler {
  private readonly logger = new Logger('TelegramInput');
  private readonly downloader: TelegramFileDownloader;
  private readonly documents = new DocumentHandler();
  private readonly pipeline = new KeyedQueue();

  constructor(
    botToken: string,
    private readonly controller: AgentController,
    private readonly output: TelegramOutputHandler,
    private readonly transcriber: WhisperTranscriber,
    private readonly tempFiles: TempFiles,
    private readonly ttsVoice: string,
  ) {
    this.downloader = new TelegramFileDownloader(botToken);
  }

  async handleText(ctx: Context): Promise<void> {
    const text = ctx.message?.text?.trim();
    if (!text) return;
    await this.process(ctx, text, 'text');
  }

  async handleDocument(ctx: Context): Promise<void> {
    const document = ctx.message?.document;
    if (!document) return;

    const kind = DocumentHandler.classify(document.mime_type, document.file_name);
    if (!kind) {
      await this.output.sendError(ctx, UNSUPPORTED_MESSAGE);
      return;
    }
    if ((document.file_size ?? 0) > MAX_DOCUMENT_BYTES) {
      await this.output.sendError(ctx, '⚠️ Esse arquivo excede os limites locais suportados (20 MB).');
      return;
    }

    const stopTyping = ChatActionKeeper.start(ctx, 'typing');
    const filePath = this.tempFiles.createPath(kind === 'pdf' ? '.pdf' : '.md');
    let text: string;
    try {
      await this.downloader.download(ctx, filePath);
      const content = await this.documents.extract(filePath, kind);
      const name = document.file_name ?? `documento.${kind === 'pdf' ? 'pdf' : 'md'}`;
      const caption = ctx.message?.caption?.trim() || 'Analise este documento.';
      text = `${caption}\n\n[Documento anexado: ${name}]\n${content || '(documento sem texto extraível)'}`;
    } catch (err) {
      await this.reportInputError(ctx, err);
      return;
    } finally {
      stopTyping();
      this.tempFiles.remove(filePath); // RF-03: nenhum resíduo em ./tmp
    }

    await this.process(ctx, text, 'document');
  }

  async handleVoice(ctx: Context): Promise<void> {
    const media = ctx.message?.voice ?? ctx.message?.audio;
    if (!media) return;

    const extension = TelegramInputHandler.audioExtension(ctx);
    const stopAction = ChatActionKeeper.start(ctx, 'record_voice');
    const filePath = this.tempFiles.createPath(extension);
    let transcript: string;
    try {
      await this.downloader.download(ctx, filePath);
      transcript = await this.transcriber.transcribe(filePath);
    } catch (err) {
      await this.reportInputError(ctx, err);
      return;
    } finally {
      stopAction();
      this.tempFiles.remove(filePath);
    }

    if (!transcript) {
      // EC-03: áudio mudo não polui o AgentLoop.
      await ctx.reply('Áudio vazio captado. Pode reenviar?').catch(() => undefined);
      return;
    }

    const caption = ctx.message?.caption?.trim();
    await this.process(ctx, caption ? `${caption}\n\n${transcript}` : transcript, 'voice');
  }

  /** /nova entra na mesma fila do usuário, para não trocar de conversa no meio de uma resposta. */
  async handleReset(ctx: Context): Promise<void> {
    const userId = String(ctx.from!.id);
    await this.pipeline.run(userId, async () => {
      this.controller.resetConversation(userId);
      await ctx.reply('✨ Conversa nova iniciada! Sobre o que vamos praticar hoje?');
    });
  }

  /** /nivelamento: começa o teste de nível direto na skill, sem passar pelo roteador. */
  async handlePlacement(ctx: Context): Promise<void> {
    await this.process(ctx, 'Quero fazer o teste de nivelamento.', 'text', PLACEMENT_SKILL);
  }

  /** /nivel mostra o perfil; /nivel B2 define o nível na mão. */
  async handleLevel(ctx: Context): Promise<void> {
    const userId = String(ctx.from!.id);
    const arg = (typeof ctx.match === 'string' ? ctx.match : '').trim().toUpperCase();
    await this.pipeline.run(userId, async () => {
      if (!arg) {
        await ctx.reply(TelegramInputHandler.describeProfile(this.controller.getStudentContext(userId)));
        return;
      }
      if (!CEFR_LEVELS.includes(arg as CefrLevel)) {
        await this.output.sendError(ctx, `⚠️ Nível inválido. Use um destes: ${CEFR_LEVELS.join(', ')} (ex.: /nivel B1).`);
        return;
      }
      this.controller.setStudentLevel(userId, arg as CefrLevel);
      await ctx.reply(`✅ Anotado: seu nível agora é ${arg}. Vou adaptar as aulas e exercícios a ele.`);
    });
  }

  private static describeProfile({ profile, vocabularyCount }: StudentContext): string {
    if (!profile?.level) {
      return 'Ainda não sei o seu nível. 🤔\n\nFaça o /nivelamento (8 questões rápidas) ou defina direto, ex.: /nivel B1.';
    }
    const none = 'nenhum anotado ainda';
    const lines = [
      '📊 Seu perfil',
      '',
      `Nível: ${profile.level} (${LEVEL_SOURCES[profile.levelSource ?? 'observacao']})`,
      `Objetivos: ${profile.goals.join('; ') || none}`,
      `Interesses: ${profile.interests.join('; ') || none}`,
      `Erros frequentes: ${profile.frequentErrors.join('; ') || none}`,
      `Temas estudados: ${profile.studiedTopics.join('; ') || none}`,
      `Vocabulário no caderno: ${vocabularyCount} termo(s)`,
      '',
      'Use /nivel B2 (por exemplo) para ajustar ou /nivelamento para refazer o teste.',
    ];
    return lines.join('\n');
  }

  async handleUnsupported(ctx: Context): Promise<void> {
    await this.output.sendError(ctx, UNSUPPORTED_MESSAGE);
  }

  private async process(ctx: Context, text: string, source: InputSource, forceSkill?: string): Promise<void> {
    const userId = String(ctx.from!.id);
    // RF-06: voz assume resposta em áudio, salvo negação explícita; texto só com pedido explícito.
    const requiresAudioReply = !AUDIO_NEGATION.test(text) && (source === 'voice' || AUDIO_REQUEST.test(text));
    const input: AgentInput = {
      userId,
      userName: ctx.from?.first_name,
      text,
      source,
      requiresAudioReply,
      voiceId: requiresAudioReply ? this.ttsVoice : undefined,
      forceSkill,
    };

    this.logger.info(`Entrada (${source}${requiresAudioReply ? ', resposta em áudio' : ''}): ${text.slice(0, 120)}`);
    // Downloads e transcrições correm em paralelo; o pipeline do agente é serializado
    // por usuário para a memória da conversa ficar na ordem certa.
    await this.pipeline.run(userId, async () => {
      const stopTyping = ChatActionKeeper.start(ctx, 'typing');
      try {
        const result = await this.controller.handle(input);
        stopTyping();
        await this.output.send(ctx, result);
      } finally {
        stopTyping();
      }
    });
  }

  private async reportInputError(ctx: Context, err: unknown): Promise<void> {
    if (err instanceof UserFacingError) {
      await this.output.sendError(ctx, err.message);
      return;
    }
    this.logger.error('Falha ao processar anexo.', err);
    await this.output.sendError(ctx, '⚠️ Não consegui processar esse anexo.');
  }

  private static audioExtension(ctx: Context): string {
    if (ctx.message?.voice) return '.ogg';
    const name = ctx.message?.audio?.file_name;
    const ext = name ? path.extname(name).toLowerCase() : '';
    return /^\.[a-z0-9]{1,5}$/.test(ext) ? ext : '.mp3';
  }
}
