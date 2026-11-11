import fs from 'node:fs';
import { Config } from './config/Config.js';
import { Database } from './memory/Database.js';
import { MemoryManager } from './memory/MemoryManager.js';
import { ProviderFactory } from './llm/ProviderFactory.js';
import { ToolFactory } from './tools/ToolFactory.js';
import { SkillLoader } from './skills/SkillLoader.js';
import { SkillRouter } from './skills/SkillRouter.js';
import { SkillExecutor } from './skills/SkillExecutor.js';
import { AgentLoop } from './core/AgentLoop.js';
import { AgentController } from './core/AgentController.js';
import { SystemPromptBuilder } from './core/SystemPromptBuilder.js';
import { FileTagExtractor } from './core/FileTagExtractor.js';
import { TelegramOutputHandler } from './telegram/TelegramOutputHandler.js';
import { TelegramInputHandler } from './telegram/TelegramInputHandler.js';
import { WhisperTranscriber } from './telegram/input/WhisperTranscriber.js';
import { TelegramBot } from './telegram/TelegramBot.js';
import { EdgeTtsCliEngine, EdgeTtsUniversalEngine, RetryingTtsEngine } from './telegram/output/tts/TtsEngine.js';
import { TempFiles } from './utils/TempFiles.js';
import { Logger } from './utils/Logger.js';

const logger = new Logger('Main');

async function main(): Promise<void> {
  const config = Config.get();
  config.validate();

  // Limpa resíduos de execuções anteriores em ./tmp.
  fs.rmSync(config.tmpDir, { recursive: true, force: true });
  const tempFiles = new TempFiles(config.tmpDir);
  fs.mkdirSync(config.skillsDir, { recursive: true });

  const database = Database.getInstance(config.dbPath);
  const memory = new MemoryManager(database, config.memoryWindowSize, config.llmProvider);

  const providers = new ProviderFactory(config);
  const llm = providers.createWithFallback(config.llmProvider, config.fallbackProviders);
  const routerLlm =
    config.routerProvider === config.llmProvider
      ? llm
      : providers.createWithFallback(config.routerProvider, [config.llmProvider]);

  const tools = new ToolFactory(tempFiles, memory).createRegistry();
  const loop = new AgentLoop(llm, tools, new SystemPromptBuilder(), config.maxIterations);

  const skillLoader = new SkillLoader(config.skillsDir);
  logger.info(`Skills instaladas: ${skillLoader.loadAll().map((s) => s.name).join(', ') || 'nenhuma'}`);

  const controller = new AgentController(
    memory,
    skillLoader,
    new SkillRouter(routerLlm),
    new SkillExecutor(skillLoader, loop),
    new FileTagExtractor(tempFiles),
  );

  const ttsEngine = new RetryingTtsEngine(
    config.ttsEngine === 'cli'
      ? new EdgeTtsCliEngine(config.ttsCliCommand, config.ttsTimeoutMs)
      : new EdgeTtsUniversalEngine(config.ttsTimeoutMs),
    config.ttsFallbackVoice,
  );
  logger.info(`TTS: ${ttsEngine.name} (${config.ttsVoice}, reserva ${config.ttsFallbackVoice})`);
  const output = new TelegramOutputHandler(tempFiles, config.ttsVoice, ttsEngine);
  const transcriber = new WhisperTranscriber(
    {
      command: config.whisperCommand,
      model: config.whisperModel,
      language: config.whisperLanguage,
      timeoutMs: config.whisperTimeoutMs,
    },
    tempFiles,
  );
  const input = new TelegramInputHandler(
    config.telegramToken,
    controller,
    output,
    transcriber,
    tempFiles,
    config.ttsVoice,
  );
  const bot = new TelegramBot(config.telegramToken, config.allowedUserIds, input);

  const shutdown = async (signal: string) => {
    logger.info(`${signal} recebido, encerrando...`);
    await bot.stop().catch(() => undefined);
    database.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  logger.info('TiaEvelyn iniciando 👩‍🏫');
  await bot.start();
}

main().catch((err) => {
  logger.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
