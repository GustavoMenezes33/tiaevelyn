import { OpenAICompatibleProvider } from './OpenAICompatibleProvider.js';

/** Google Gemini via endpoint compatível com OpenAI. */
export class GeminiProvider extends OpenAICompatibleProvider {
  readonly name = 'gemini';
  protected readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai';
}

/** DeepSeek (API nativamente compatível com OpenAI). */
export class DeepSeekProvider extends OpenAICompatibleProvider {
  readonly name = 'deepseek';
  protected readonly baseUrl = 'https://api.deepseek.com/v1';
}

/** Groq (API compatível com OpenAI). */
export class GroqProvider extends OpenAICompatibleProvider {
  readonly name = 'groq';
  protected readonly baseUrl = 'https://api.groq.com/openai/v1';
}
