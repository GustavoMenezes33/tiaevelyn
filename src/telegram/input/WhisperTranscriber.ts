import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { TempFiles } from '../../utils/TempFiles.js';
import { UserFacingError } from '../UserFacingError.js';
import { Logger } from '../../utils/Logger.js';

export interface WhisperOptions {
  command: string;
  model: string;
  language: string;
  timeoutMs: number;
}

/**
 * STT local: executa o CLI do Whisper (openai-whisper) como child process.
 * Requer `whisper` e `ffmpeg` instalados no PATH da máquina host.
 */
export class WhisperTranscriber {
  private readonly logger = new Logger('Whisper');

  constructor(
    private readonly options: WhisperOptions,
    private readonly tempFiles: TempFiles,
  ) {}

  async transcribe(audioPath: string): Promise<string> {
    const outputDir = this.tempFiles.createPath('.whisper');
    await fs.mkdir(outputDir, { recursive: true });

    const args = [
      audioPath,
      '--model', this.options.model,
      '--output_format', 'txt',
      '--output_dir', outputDir,
      '--fp16', 'False',
      '--verbose', 'False',
    ];
    if (this.options.language) args.push('--language', this.options.language);

    try {
      await this.run(args);
      const txtPath = path.join(outputDir, `${path.parse(audioPath).name}.txt`);
      const transcript = (await fs.readFile(txtPath, 'utf8')).trim();
      this.logger.info(`Transcript: ${transcript.slice(0, 200)}`);
      return transcript;
    } finally {
      this.tempFiles.remove(outputDir);
    }
  }

  private run(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      // stdout ignorado: o resultado vem do arquivo .txt, e um pipe não lido poderia encher e travar o processo.
      const child = spawn(this.options.command, args, {
        windowsHide: true,
        stdio: ['ignore', 'ignore', 'pipe'],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      });
      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => {
        stderr = (stderr + chunk.toString()).slice(-2000);
      });

      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve();
      };

      const timer = setTimeout(() => {
        child.kill();
        this.logger.error(`Whisper excedeu ${this.options.timeoutMs}ms e foi encerrado.`);
        finish(new UserFacingError('⚠️ Falha ao processar o áudio: arquivo grande demais ou falha no serviço.'));
      }, this.options.timeoutMs);

      child.on('error', (err: NodeJS.ErrnoException) => {
        this.logger.error(`Não foi possível iniciar "${this.options.command}": ${err.code ?? err.message}`);
        finish(new UserFacingError('⚠️ Não consegui inicializar o Whisper local agora.'));
      });

      child.on('close', (code) => {
        if (settled) return;
        if (code === 0) return finish();
        this.logger.error(`Whisper saiu com código ${code}: ${stderr.trim()}`);
        finish(new UserFacingError('⚠️ Falha ao processar o áudio: arquivo grande demais ou falha no serviço.'));
      });
    });
  }
}
