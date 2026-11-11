import fs from 'node:fs';
import { InputFile, type Context } from 'grammy';
import type { OutputFile } from '../../tools/BaseTool.js';
import type { TempFiles } from '../../utils/TempFiles.js';
import { safeSend, type OutputStrategy } from './OutputStrategy.js';
import { TextOutputStrategy } from './TextOutputStrategy.js';
import { Logger } from '../../utils/Logger.js';

/** Envia arquivos gerados como documentos e remove os temporários. */
export class FileOutputStrategy implements OutputStrategy<OutputFile> {
  private readonly logger = new Logger('FileOutput');

  constructor(
    private readonly tempFiles: TempFiles,
    private readonly textFallback: TextOutputStrategy,
  ) {}

  async send(ctx: Context, file: OutputFile): Promise<void> {
    try {
      await safeSend(() =>
        ctx.replyWithDocument(new InputFile(file.path, file.filename), { caption: `📄 ${file.filename}` }),
      );
    } catch (err) {
      // EC-02: falha no arquivo -> envia o conteúdo como texto.
      this.logger.error(`Falha ao enviar "${file.filename}".`, err);
      const content = fs.existsSync(file.path) ? fs.readFileSync(file.path, 'utf8') : '';
      if (content) await this.textFallback.send(ctx, `Não consegui gerar o arquivo, segue texto puro:\n\n${content}`);
    } finally {
      this.tempFiles.remove(file.path);
    }
  }
}
