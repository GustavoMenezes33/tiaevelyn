import fs from 'node:fs/promises';
import { PDFParse } from 'pdf-parse';
import { UserFacingError } from '../UserFacingError.js';

/** Tamanho máximo de arquivo aceito para extração (EC-04). */
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
/** Limite de texto extraído repassado ao LLM. */
const MAX_EXTRACTED_CHARS = 60_000;

export type DocumentKind = 'pdf' | 'markdown';

/** Extrai texto de documentos PDF e Markdown. */
export class DocumentHandler {
  /** Classifica o anexo; retorna null se o formato não for suportado. */
  static classify(mimeType: string | undefined, fileName: string | undefined): DocumentKind | null {
    const name = fileName?.toLowerCase() ?? '';
    if (mimeType === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
    if (name.endsWith('.md') || name.endsWith('.markdown') || mimeType === 'text/markdown') return 'markdown';
    return null;
  }

  async extract(filePath: string, kind: DocumentKind): Promise<string> {
    const stats = await fs.stat(filePath);
    if (stats.size > MAX_DOCUMENT_BYTES) {
      throw new UserFacingError('⚠️ Esse arquivo excede os limites locais suportados (20 MB).');
    }

    const text = kind === 'pdf' ? await this.extractPdf(filePath) : await fs.readFile(filePath, 'utf8');
    const clean = text.replace(/\u0000/g, '').trim();
    return clean.length > MAX_EXTRACTED_CHARS
      ? `${clean.slice(0, MAX_EXTRACTED_CHARS)}\n…[documento truncado: ${clean.length} caracteres no total]`
      : clean;
  }

  private async extractPdf(filePath: string): Promise<string> {
    const parser = new PDFParse({ data: await fs.readFile(filePath) });
    try {
      const result = await parser.getText();
      return result.text;
    } catch {
      throw new UserFacingError('⚠️ Não consegui ler esse PDF (arquivo corrompido ou protegido).');
    } finally {
      await parser.destroy();
    }
  }
}
