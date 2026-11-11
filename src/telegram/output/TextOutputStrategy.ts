import { GrammyError, type Context } from 'grammy';
import { safeSend, type OutputStrategy } from './OutputStrategy.js';
import { TelegramFormatter } from './TelegramFormatter.js';

/** Limite do Telegram é 4096 caracteres; a margem cobre as tags HTML geradas. */
const MAX_CHUNK = 3500;

/** Envia texto formatado, fatiando em várias mensagens (em ordem) quando passa do limite. */
export class TextOutputStrategy implements OutputStrategy<string> {
  async send(ctx: Context, text: string): Promise<void> {
    // RNF-01: for...of sequencial garante ordem cronológica.
    for (const chunk of TextOutputStrategy.split(text)) {
      const delivered = await safeSend(() => TextOutputStrategy.reply(ctx, chunk));
      if (!delivered) return;
    }
  }

  /** Tenta HTML; se o Telegram recusar a marcação (400), reenvia como texto puro. */
  private static async reply(ctx: Context, chunk: string): Promise<unknown> {
    try {
      return await ctx.reply(TelegramFormatter.toHtml(chunk), {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });
    } catch (err) {
      if (err instanceof GrammyError && err.error_code === 400) return ctx.reply(TelegramFormatter.toPlain(chunk));
      throw err;
    }
  }

  /** Divide preferindo quebras de parágrafo, depois de linha, depois espaço. */
  static split(text: string, max = MAX_CHUNK): string[] {
    const chunks: string[] = [];
    let rest = text.trim();
    while (rest.length > max) {
      const window = rest.slice(0, max);
      let cut = window.lastIndexOf('\n\n');
      if (cut < max * 0.5) cut = window.lastIndexOf('\n');
      if (cut < max * 0.5) cut = window.lastIndexOf(' ');
      if (cut <= 0) cut = max;
      chunks.push(rest.slice(0, cut).trimEnd());
      rest = rest.slice(cut).trimStart();
    }
    if (rest) chunks.push(rest);
    return chunks;
  }
}
