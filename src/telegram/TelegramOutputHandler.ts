import type { Context } from 'grammy';
import type { AgentOutput } from '../core/types.js';
import type { TempFiles } from '../utils/TempFiles.js';
import { TextOutputStrategy } from './output/TextOutputStrategy.js';
import { FileOutputStrategy } from './output/FileOutputStrategy.js';
import { AudioOutputStrategy } from './output/AudioOutputStrategy.js';
import { ErrorOutputStrategy } from './output/ErrorOutputStrategy.js';
import type { ITtsEngine } from './output/tts/TtsEngine.js';
import { Logger } from '../utils/Logger.js';

/** Escolhe a estratégia de saída adequada para cada resultado do pipeline. */
export class TelegramOutputHandler {
  private readonly logger = new Logger('TelegramOutput');
  private readonly text = new TextOutputStrategy();
  private readonly error = new ErrorOutputStrategy();
  private readonly file: FileOutputStrategy;
  private readonly audio: AudioOutputStrategy;

  constructor(
    private readonly tempFiles: TempFiles,
    private readonly defaultVoice: string,
    ttsEngine: ITtsEngine,
  ) {
    this.file = new FileOutputStrategy(tempFiles, this.text);
    this.audio = new AudioOutputStrategy(ttsEngine, tempFiles, this.text);
  }

  async send(ctx: Context, output: AgentOutput): Promise<void> {
    try {
      if (output.isError) {
        await this.error.send(ctx, output.text);
      } else if (output.text) {
        if (output.isAudio) {
          await this.audio.send(ctx, { text: output.text, voice: output.voiceId ?? this.defaultVoice });
        } else {
          await this.text.send(ctx, output.text);
        }
      }

      for (const file of output.files) await this.file.send(ctx, file);
    } catch (err) {
      this.logger.error('Falha ao enviar resposta ao Telegram.', err);
    } finally {
      // Garante que nenhum arquivo gerado fique em ./tmp, mesmo após falhas.
      for (const file of output.files) this.tempFiles.remove(file.path);
    }
  }

  async sendError(ctx: Context, message: string): Promise<void> {
    try {
      await this.error.send(ctx, message);
    } catch (err) {
      this.logger.error('Falha ao enviar aviso de erro.', err);
    }
  }
}
