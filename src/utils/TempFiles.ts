import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/** Gerencia arquivos temporários em `./tmp`, garantindo limpeza após o uso. */
export class TempFiles {
  constructor(readonly dir: string) {
    fs.mkdirSync(dir, { recursive: true });
  }

  /** Gera um caminho único dentro do diretório temporário. */
  createPath(extension: string): string {
    const ext = extension.startsWith('.') ? extension : `.${extension}`;
    return path.join(this.dir, `${randomUUID()}${ext}`);
  }

  /** Remove o arquivo/diretório silenciosamente (usado em blocos `finally`). */
  remove(filePath: string | null | undefined): void {
    if (!filePath) return;
    try {
      fs.rmSync(filePath, { force: true, recursive: true });
    } catch {
      // Arquivo já removido ou bloqueado: nada a fazer.
    }
  }
}

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
