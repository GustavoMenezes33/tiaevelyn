import fs from 'node:fs';
import type { Context } from 'grammy';
import { UserFacingError } from '../UserFacingError.js';

/** Sem bytes recebidos por este tempo, o download é abortado (EC-05). */
const IDLE_TIMEOUT_MS = 15_000;

/** Baixa anexos do Telegram para o disco local. */
export class TelegramFileDownloader {
  constructor(private readonly botToken: string) {}

  async download(ctx: Context, destination: string): Promise<void> {
    const file = await ctx.getFile();
    if (!file.file_path) throw new UserFacingError('⚠️ Falha ao baixar arquivo do Telegram. Tente novamente.');

    const url = `https://api.telegram.org/file/bot${this.botToken}/${file.file_path}`;
    const controller = new AbortController();
    let idleTimer = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS);
    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS);
    };

    const out = fs.createWriteStream(destination);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        resetIdle();
        if (!out.write(value)) await new Promise((resolve) => out.once('drain', resolve));
      }
      await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));
    } catch {
      out.destroy();
      throw new UserFacingError('⚠️ Falha ao baixar arquivo do Telegram. Tente novamente.');
    } finally {
      clearTimeout(idleTimer);
    }
  }
}
