import type { Context } from 'grammy';

type ChatAction = 'typing' | 'record_voice' | 'upload_document' | 'upload_voice';

/** Mantém o indicador "digitando..." ativo até o processamento terminar. */
export class ChatActionKeeper {
  private static readonly REFRESH_MS = 4500;

  /** Inicia o indicador e retorna a função que o encerra. */
  static start(ctx: Context, action: ChatAction = 'typing'): () => void {
    const send = () => void ctx.replyWithChatAction(action).catch(() => undefined);
    send();
    const timer = setInterval(send, ChatActionKeeper.REFRESH_MS);
    return () => clearInterval(timer);
  }
}
