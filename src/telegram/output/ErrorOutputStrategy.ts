import type { Context } from 'grammy';
import { safeSend, type OutputStrategy } from './OutputStrategy.js';

/** Envia avisos de erro formatados com ⚠️, sem detalhes internos. */
export class ErrorOutputStrategy implements OutputStrategy<string> {
  async send(ctx: Context, message: string): Promise<void> {
    const text = message.startsWith('⚠️') ? message : `⚠️ Erro: ${message}`;
    await safeSend(() => ctx.reply(text));
  }
}
