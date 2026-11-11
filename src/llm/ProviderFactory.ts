import type { Config, ProviderName } from '../config/Config.js';
import type { ILlmProvider } from './ILlmProvider.js';
import { FallbackProvider } from './FallbackProvider.js';
import { DeepSeekProvider, GeminiProvider, GroqProvider } from './providers.js';
import { AnthropicProvider } from './AnthropicProvider.js';
import { Logger } from '../utils/Logger.js';

/** Factory dos "cérebros": trocar `LLM_PROVIDER` no `.env` troca o LLM usado. */
export class ProviderFactory {
  private readonly logger = new Logger('ProviderFactory');

  constructor(private readonly config: Config) {}

  create(name: ProviderName): ILlmProvider {
    const { apiKey, model } = this.config.providers[name];
    const timeout = this.config.llmTimeoutMs;
    switch (name) {
      case 'gemini':
        return new GeminiProvider(apiKey, model, timeout);
      case 'deepseek':
        return new DeepSeekProvider(apiKey, model, timeout);
      case 'groq':
        return new GroqProvider(apiKey, model, timeout);
      case 'anthropic':
        return new AnthropicProvider(apiKey, model, timeout, this.config.anthropicEffort);
    }
  }

  /** Provedor principal encadeado com os fallbacks que tiverem API key configurada. */
  createWithFallback(primary: ProviderName, fallbacks: ProviderName[]): ILlmProvider {
    const usable = fallbacks.filter((name) => {
      const ok = Boolean(this.config.providers[name].apiKey);
      if (!ok) this.logger.warn(`Fallback "${name}" ignorado: sem API key.`);
      return ok;
    });
    const chain = [primary, ...usable].map((name) => this.create(name));
    const provider = chain.length === 1 ? chain[0]! : new FallbackProvider(chain);
    this.logger.info(`LLM ativo: ${provider.name}`);
    return provider;
  }
}
