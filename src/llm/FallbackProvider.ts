import type { ChatMessage, ChatOptions, ILlmProvider, LlmResponse } from './ILlmProvider.js';
import { Logger } from '../utils/Logger.js';

/**
 * Encadeia provedores: se o primário falhar (503, timeout, key inválida...),
 * tenta o próximo da lista. Só lança erro se todos falharem.
 */
export class FallbackProvider implements ILlmProvider {
  private readonly logger = new Logger('FallbackProvider');
  readonly name: string;

  constructor(private readonly chain: ILlmProvider[]) {
    if (chain.length === 0) throw new Error('FallbackProvider precisa de ao menos um provedor.');
    this.name = chain.map((p) => p.name).join(' -> ');
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<LlmResponse> {
    let lastError: unknown;
    for (const provider of this.chain) {
      try {
        return await provider.chat(messages, options);
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Provedor "${provider.name}" falhou: ${msg}`);
      }
    }
    throw lastError;
  }
}
