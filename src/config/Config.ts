import 'dotenv/config';
import path from 'node:path';

export type ProviderName = 'gemini' | 'deepseek' | 'groq' | 'anthropic';
const PROVIDER_NAMES: readonly ProviderName[] = ['gemini', 'deepseek', 'groq', 'anthropic'];

export interface ProviderSettings {
  apiKey: string;
  model: string;
}

/**
 * Configuração central da aplicação, lida do `.env` uma única vez (Singleton).
 */
export class Config {
  private static instance: Config | null = null;

  readonly telegramToken: string;
  readonly allowedUserIds: ReadonlySet<number>;

  readonly llmProvider: ProviderName;
  readonly fallbackProviders: ProviderName[];
  readonly routerProvider: ProviderName;
  readonly providers: Record<ProviderName, ProviderSettings>;
  readonly anthropicEffort: 'low' | 'medium' | 'high';

  readonly maxIterations: number;
  readonly llmTimeoutMs: number;

  readonly dbPath: string;
  readonly memoryWindowSize: number;

  readonly skillsDir: string;
  readonly tmpDir: string;

  readonly whisperCommand: string;
  readonly whisperModel: string;
  readonly whisperLanguage: string;
  readonly whisperTimeoutMs: number;
  readonly ttsVoice: string;
  readonly ttsFallbackVoice: string;
  readonly ttsEngine: 'universal' | 'cli';
  readonly ttsCliCommand: string;
  readonly ttsTimeoutMs: number;

  private constructor(env: NodeJS.ProcessEnv) {
    this.telegramToken = env.TELEGRAM_BOT_TOKEN?.trim() ?? '';
    this.allowedUserIds = new Set(
      (env.TELEGRAM_ALLOWED_USER_IDS ?? '')
        .split(',')
        .map((id) => Number(id.trim()))
        .filter((id) => Number.isInteger(id) && id > 0),
    );

    this.llmProvider = Config.parseProvider(env.LLM_PROVIDER, 'gemini');
    this.fallbackProviders = (env.LLM_FALLBACK_PROVIDERS ?? '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => Config.parseProvider(p, this.llmProvider))
      .filter((p, i, all) => p !== this.llmProvider && all.indexOf(p) === i);
    this.routerProvider = Config.parseProvider(env.ROUTER_PROVIDER, this.llmProvider);
    this.providers = {
      gemini: { apiKey: env.GEMINI_API_KEY ?? '', model: env.GEMINI_MODEL || 'gemini-2.5-flash' },
      deepseek: { apiKey: env.DEEPSEEK_API_KEY ?? '', model: env.DEEPSEEK_MODEL || 'deepseek-chat' },
      groq: { apiKey: env.GROQ_API_KEY ?? '', model: env.GROQ_MODEL || 'llama-3.3-70b-versatile' },
      anthropic: { apiKey: env.ANTHROPIC_API_KEY ?? '', model: env.ANTHROPIC_MODEL || 'claude-opus-5-5' },
    };
    const effort = env.ANTHROPIC_EFFORT?.trim().toLowerCase();
    this.anthropicEffort = effort === 'low' || effort === 'high' ? effort : 'medium';

    // EC-03 (agent-loop): fallback explícito para 5 se a variável não for lida.
    this.maxIterations = Config.parsePositiveInt(env.MAX_ITERATIONS, 5);
    this.llmTimeoutMs = Config.parsePositiveInt(env.LLM_TIMEOUT_MS, 120_000);

    this.dbPath = path.resolve(env.DB_PATH || './data/tiaevelyn.db');
    this.memoryWindowSize = Config.parsePositiveInt(env.MEMORY_WINDOW_SIZE, 20);

    this.skillsDir = path.resolve(env.SKILLS_DIR || './.agents/skills');
    this.tmpDir = path.resolve(env.TMP_DIR || './tmp');

    this.whisperCommand = env.WHISPER_COMMAND || 'whisper';
    this.whisperModel = env.WHISPER_MODEL || 'base';
    this.whisperLanguage = env.WHISPER_LANGUAGE?.trim() ?? '';
    this.whisperTimeoutMs = Config.parsePositiveInt(env.WHISPER_TIMEOUT_MS, 60_000);
    this.ttsVoice = env.TTS_VOICE || 'pt-BR-ThalitaMultilingualNeural';
    this.ttsFallbackVoice = env.TTS_FALLBACK_VOICE?.trim() || 'pt-BR-FranciscaNeural';
    this.ttsEngine = env.TTS_ENGINE?.trim().toLowerCase() === 'cli' ? 'cli' : 'universal';
    this.ttsCliCommand = env.TTS_CLI_COMMAND || 'edge-tts';
    this.ttsTimeoutMs = Config.parsePositiveInt(env.TTS_TIMEOUT_MS, 30_000);
  }

  static get(): Config {
    if (!Config.instance) Config.instance = new Config(process.env);
    return Config.instance;
  }

  /** Valida o mínimo necessário para o bot subir. Lança erro descritivo. */
  validate(): void {
    const problems: string[] = [];
    if (!this.telegramToken) problems.push('TELEGRAM_BOT_TOKEN não definido.');
    if (this.allowedUserIds.size === 0) {
      problems.push('TELEGRAM_ALLOWED_USER_IDS vazio: ninguém conseguiria usar o bot.');
    }
    if (!this.providers[this.llmProvider].apiKey) {
      problems.push(`API key do provedor principal "${this.llmProvider}" não definida.`);
    }
    if (problems.length) throw new Error(`Configuração inválida:\n - ${problems.join('\n - ')}`);
  }

  private static parseProvider(value: string | undefined, fallback: ProviderName): ProviderName {
    const v = value?.trim().toLowerCase();
    return PROVIDER_NAMES.find((p) => p === v) ?? fallback;
  }

  private static parsePositiveInt(value: string | undefined, fallback: number): number {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : fallback;
  }
}
