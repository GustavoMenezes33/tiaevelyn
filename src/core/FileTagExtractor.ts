import fs from 'node:fs';
import type { OutputFile } from '../tools/BaseTool.js';
import type { TempFiles } from '../utils/TempFiles.js';
import { Logger } from '../utils/Logger.js';

const FILE_TAG = /<arquivo\s+nome=["']([^"']+)["']\s*>([\s\S]*?)<\/arquivo>/gi;

/**
 * Detecta blocos `<arquivo nome="x.md">...</arquivo>` na resposta final do LLM,
 * grava cada um em `./tmp` e substitui o bloco por uma referência curta no texto.
 */
export class FileTagExtractor {
  private readonly logger = new Logger('FileTagExtractor');

  constructor(private readonly tempFiles: TempFiles) {}

  extract(answer: string): { text: string; files: OutputFile[] } {
    const files: OutputFile[] = [];
    const text = answer.replace(FILE_TAG, (block, rawName: string, content: string) => {
      const filename = FileTagExtractor.sanitize(rawName);
      try {
        const filePath = this.tempFiles.createPath('.md');
        fs.writeFileSync(filePath, content.trim(), 'utf8');
        files.push({ path: filePath, filename });
        return `📎 ${filename}`;
      } catch (err) {
        // EC-02 (output): sem permissão de escrita -> mantém o conteúdo como texto.
        this.logger.error(`Não foi possível gravar "${filename}".`, err);
        return `Não consegui gerar o arquivo ${filename}, segue o texto puro:\n\n${content.trim()}`;
      }
    });
    return { text: text.trim(), files };
  }

  private static sanitize(raw: string): string {
    const name = (raw.split(/[\\/]/).pop() ?? '').replace(/[^\w.-]/g, '_').slice(0, 100) || 'arquivo';
    return /\.(md|txt)$/i.test(name) ? name : `${name}.md`;
  }
}
