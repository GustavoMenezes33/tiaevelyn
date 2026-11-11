import fs from 'node:fs/promises';
import { BaseTool, type ToolExecutionContext, type ToolResult } from './BaseTool.js';
import type { TempFiles } from '../utils/TempFiles.js';

const ALLOWED_EXTENSIONS = ['.md', '.txt'];
const MAX_CONTENT_CHARS = 500_000;

/**
 * Cria um arquivo de texto/markdown e o agenda para envio ao usuário no Telegram.
 * O arquivo é gravado em `./tmp` e removido após o envio.
 */
export class CreateFileTool extends BaseTool {
  readonly name = 'criar_arquivo';
  readonly description =
    'Cria um arquivo (.md ou .txt) com o conteúdo informado e o envia ao usuário como documento no Telegram. ' +
    'Use para materiais longos: planos de aula, listas de exercícios, resumos, glossários.';
  readonly parameters = {
    type: 'object',
    properties: {
      filename: { type: 'string', description: 'Nome do arquivo, ex.: "lesson-01.md". Apenas letras, números, "-", "_" e ".".' },
      content: { type: 'string', description: 'Conteúdo completo do arquivo.' },
    },
    required: ['filename', 'content'],
  };

  constructor(private readonly tempFiles: TempFiles) {
    super();
  }

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const filename = CreateFileTool.sanitizeFilename(this.requireString(args, 'filename'));
    const content = this.requireString(args, 'content');
    if (content.length > MAX_CONTENT_CHARS) {
      throw new Error(`Conteúdo excede o limite de ${MAX_CONTENT_CHARS} caracteres.`);
    }

    const extension = filename.slice(filename.lastIndexOf('.'));
    const filePath = this.tempFiles.createPath(extension);
    await fs.writeFile(filePath, content, 'utf8');
    context.files.push({ path: filePath, filename });

    return { output: `Arquivo "${filename}" criado (${content.length} caracteres) e será enviado ao usuário.` };
  }

  /** Remove qualquer componente de caminho e caracteres perigosos; força extensão permitida. */
  private static sanitizeFilename(raw: string): string {
    const base = raw.split(/[\\/]/).pop() ?? 'arquivo';
    let name = base.replace(/[^\w.-]/g, '_').replace(/^\.+/, '').slice(0, 100) || 'arquivo';
    const lower = name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))) name += '.md';
    return name;
  }
}
