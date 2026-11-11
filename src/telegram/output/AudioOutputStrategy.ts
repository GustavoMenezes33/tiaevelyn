import fs from 'node:fs';
import { InputFile, type Context } from 'grammy';
import type { TempFiles } from '../../utils/TempFiles.js';
import { ChatActionKeeper } from '../ChatActionKeeper.js';
import { safeSend, type OutputStrategy } from './OutputStrategy.js';
import { TextOutputStrategy } from './TextOutputStrategy.js';
import type { ITtsEngine } from './tts/TtsEngine.js';
import { Logger } from '../../utils/Logger.js';

export interface AudioPayload {
  text: string;
  voice: string;
}

/** Sintetiza a resposta com Edge-TTS e envia como mensagem de voz. */
export class AudioOutputStrategy implements OutputStrategy<AudioPayload> {
  private readonly logger = new Logger('AudioOutput');

  constructor(
    private readonly engine: ITtsEngine,
    private readonly tempFiles: TempFiles,
    private readonly textFallback: TextOutputStrategy,
  ) {}

  async send(ctx: Context, payload: AudioPayload): Promise<void> {
    const speech = AudioOutputStrategy.stripMarkdown(payload.text);
    if (!AudioOutputStrategy.isSpeakable(speech)) {
      await this.textFallback.send(ctx, payload.text);
      return;
    }

    const stopAction = ChatActionKeeper.start(ctx, 'record_voice');
    const filePath = this.tempFiles.createPath('.mp3');
    try {
      await this.engine.synthesize(speech, payload.voice, filePath);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) throw new Error('áudio vazio');
      stopAction();
      await safeSend(() => ctx.replyWithVoice(new InputFile(filePath)));
    } catch (err) {
      // Fallback para texto com aviso.
      this.logger.error(`Falha no TTS (${this.engine.name}): ${err instanceof Error ? err.message : err}`);
      stopAction();
      await this.textFallback.send(ctx, `⚠️ Não consegui gerar o áudio, segue em texto:\n\n${payload.text}`);
    } finally {
      stopAction();
      this.tempFiles.remove(filePath);
    }
  }

  /** Remove sintaxe Markdown/links/emojis que soariam estranhos na fala. */
  static stripMarkdown(text: string): string {
    return text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/[*_~>|#]/g, '')
      .replace(/\p{Extended_Pictographic}/gu, '')
      // Restos invisíveis de emoji (U+FE0F, ZWJ, tons de pele): sozinhos, o Edge-TTS responde NoAudioReceived.
      .replace(/[​-‍⁠︎️]|\p{Emoji_Modifier}/gu, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\s+\n/g, '\n')
      .trim();
  }

  /** Só vale sintetizar se houver algo pronunciável (letra ou número). */
  static isSpeakable(text: string): boolean {
    return /[\p{L}\p{N}]/u.test(text);
  }
}
