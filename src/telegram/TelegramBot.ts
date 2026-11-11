import { Bot, GrammyError, HttpError, type Context, type NextFunction } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import { run, type RunnerHandle } from '@grammyjs/runner';
import type { TelegramInputHandler } from './TelegramInputHandler.js';
import { Logger } from '../utils/Logger.js';

const HELP_TEXT = `Hi! Eu sou a Tia Evelyn, sua professora de inglês. 👩‍🏫

Pode me mandar:
• mensagens de texto (em português ou inglês)
• áudios — eu transcrevo e respondo em áudio
• documentos .pdf ou .md para eu analisar

Alguns pedidos que eu entendo:
• "corrige meu texto: ..." ou "me passa uma tarefa de escrita"
• "quero um texto pra ler" (leitura com perguntas)
• "me explica present perfect" ou "exercícios dos meus erros"
• "palavras de viagem", "phrasal verbs com get", "falsos cognatos"
• "monta uma aula sobre ..." (arquivo completo)
• "vamos conversar em inglês"

Comandos:
/nivelamento — teste rápido para descobrir seu nível (A1 a C2)
/nivel — mostra seu nível e pontos de atenção (/nivel B1 para ajustar)
/nova — começa uma conversa nova (esquece o contexto atual)
/ajuda — mostra esta mensagem`;

/** Configura o bot grammy: whitelist, comandos e roteamento por tipo de mensagem. */
export class TelegramBot {
  private readonly logger = new Logger('TelegramBot');
  private readonly bot: Bot;
  private runner: RunnerHandle | null = null;

  constructor(
    token: string,
    private readonly allowedUserIds: ReadonlySet<number>,
    private readonly input: TelegramInputHandler,
  ) {
    this.bot = new Bot(token);
    // EC-01 (output): 429 -> respeita Retry-After e reenvia.
    this.bot.api.config.use(autoRetry({ maxRetryAttempts: 5, maxDelaySeconds: 60 }));
    this.registerHandlers();
  }

  async start(): Promise<void> {
    const me = await this.bot.api.getMe();
    this.logger.info(`Bot @${me.username} conectado. Aguardando mensagens (long polling)...`);
    // RNF-01: o runner processa updates em paralelo, então um áudio ou PDF demorado
    // não segura as outras mensagens. A ordem por usuário é garantida no TelegramInputHandler.
    this.runner = run(this.bot);
    await this.runner.task();
  }

  async stop(): Promise<void> {
    if (this.runner?.isRunning()) await this.runner.stop();
  }

  private registerHandlers(): void {
    // Middleware de topo: corta qualquer usuário fora da whitelist antes de tudo (RF-02 / EC-01).
    this.bot.use((ctx, next) => this.whitelist(ctx, next));

    this.bot.command(['start', 'ajuda', 'help'], (ctx) => ctx.reply(HELP_TEXT));
    this.bot.command(['nova', 'reset'], (ctx) => this.input.handleReset(ctx));
    this.bot.command('nivelamento', (ctx) => this.input.handlePlacement(ctx));
    this.bot.command('nivel', (ctx) => this.input.handleLevel(ctx));

    this.bot.on('message:text', (ctx) => this.input.handleText(ctx));
    this.bot.on('message:document', (ctx) => this.input.handleDocument(ctx));
    this.bot.on(['message:voice', 'message:audio'], (ctx) => this.input.handleVoice(ctx));
    this.bot.on('message', (ctx) => this.input.handleUnsupported(ctx));

    this.bot.catch((err) => {
      const e = err.error;
      if (e instanceof GrammyError) this.logger.error(`Erro da API do Telegram: ${e.description}`);
      else if (e instanceof HttpError) this.logger.error('Falha de rede com o Telegram.', e.error);
      else this.logger.error('Erro não tratado no handler.', e);
    });
  }

  private async whitelist(ctx: Context, next: NextFunction): Promise<void> {
    const userId = ctx.from?.id;
    if (userId !== undefined && this.allowedUserIds.has(userId)) {
      await next();
      return;
    }
    // Ignora silenciosamente, sem logar conteúdo e sem chamar LLM ou banco.
    this.logger.debug(`Update ignorado de usuário não autorizado (${userId ?? 'desconhecido'}).`);
  }
}
