/**
 * Converte o Markdown simples que os LLMs produzem para o HTML aceito pelo Telegram
 * (<b>, <i>, <s>, <code>, <pre>, <a>). Todo o resto é escapado, então o texto
 * nunca quebra o parser do Telegram por causa de caracteres especiais.
 */
export class TelegramFormatter {
  static toHtml(markdown: string): string {
    const placeholders: string[] = [];
    const hold = (html: string) => `\u0000${placeholders.push(html) - 1}\u0000`;

    let text = markdown
      // Blocos e trechos de código primeiro, para não formatar o que está dentro deles.
      .replace(/```[^\n]*\n?([\s\S]*?)```/g, (_, code: string) => hold(`<pre>${TelegramFormatter.escape(code.trimEnd())}</pre>`))
      .replace(/`([^`\n]+)`/g, (_, code: string) => hold(`<code>${TelegramFormatter.escape(code)}</code>`));

    text = TelegramFormatter.escape(text)
      // Links [texto](http...)
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, label: string, url: string) => `<a href="${url.replace(/"/g, '&quot;')}">${label}</a>`)
      // Títulos viram negrito (o Telegram não tem cabeçalhos).
      .replace(/^#{1,6}\s+(.+?)\s*#*$/gm, '<b>$1</b>')
      // Listas com "*" ou "-" viram "•" (evita confundir com itálico).
      .replace(/^(\s*)[*-]\s+/gm, '$1• ')
      .replace(/\*\*(?=\S)([^*\n]+?)\*\*/g, '<b>$1</b>')
      .replace(/__(?=\S)([^_\n]+?)__/g, '<b>$1</b>')
      .replace(/~~(?=\S)([^~\n]+?)~~/g, '<s>$1</s>')
      .replace(/(?<![\w*])\*(?=\S)([^*\n]+?)\*(?![\w*])/g, '<i>$1</i>')
      .replace(/(?<![\w_])_(?=\S)([^_\n]+?)_(?![\w_])/g, '<i>$1</i>');

    return text.replace(/\u0000(\d+)\u0000/g, (_, i: string) => placeholders[Number(i)]!);
  }

  /** Versão sem marcação, usada se o Telegram rejeitar o HTML. */
  static toPlain(markdown: string): string {
    return markdown
      .replace(/```[^\n]*\n?([\s\S]*?)```/g, '$1')
      .replace(/`([^`\n]+)`/g, '$1')
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1 ($2)')
      .replace(/^#{1,6}\s+(.+?)\s*#*$/gm, '$1')
      .replace(/^(\s*)[*-]\s+/gm, '$1• ')
      .replace(/\*\*([^*\n]+)\*\*|__([^_\n]+)__|~~([^~\n]+)~~/g, (_, a, b, c) => a ?? b ?? c)
      .replace(/(?<![\w*])\*(?=\S)([^*\n]+?)\*(?![\w*])/g, '$1');
  }

  private static escape(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
