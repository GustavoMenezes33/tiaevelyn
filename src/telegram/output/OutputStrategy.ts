import type { Context } from 'grammy';
import { GrammyError } from 'grammy';
import { Logger } from '../../utils/Logger.js';

/** Contrato das estratégias de saída (Strategy Pattern). */
export interface OutputStrategy<T> {
  send(ctx: Context, payload: T): Promise<void>;
}

const logger = new Logger('TelegramOutput');

/**
 * Executa um envio tratando usuário que bloqueou o bot (EC-03): loga e descarta.
 * Rate limit (429) é tratado globalmente pelo plugin auto-retry.
 */
export async function safeSend(action: () => Promise<unknown>): Promise<boolean> {
  try {
    await action();
    return true;
  } catch (err) {
    if (err instanceof GrammyError && err.error_code === 403) {
      logger.warn('Msg abandonada, User bot-blocked.');
      return false;
    }
    throw err;
  }
}
