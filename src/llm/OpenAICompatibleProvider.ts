import { randomUUID } from 'node:crypto';
import {
  LlmProviderError,
  type ChatMessage,
  type ChatOptions,
  type ILlmProvider,
  type LlmResponse,
  type ToolCall,
} from './ILlmProvider.js';

interface OpenAIToolCall {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
  [key: string]: unknown;
}

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string | null; tool_calls?: OpenAIToolCall[] } }>;
}

/**
 * Base para provedores que expõem a API de Chat Completions no formato OpenAI.
 * Gemini, DeepSeek e Groq oferecem endpoints compatíveis, então cada subclasse
 * só precisa informar URL base e modelo.
 */
export abstract class OpenAICompatibleProvider implements ILlmProvider {
  abstract readonly name: string;
  protected abstract readonly baseUrl: string;

  constructor(
    protected readonly apiKey: string,
    protected readonly model: string,
    private readonly timeoutMs: number,
  ) {}

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<LlmResponse> {
    if (!this.apiKey) throw new LlmProviderError(this.name, 'API key não configurada.');

    const body: Record<string, unknown> = {
      model: this.model,
      messages: messages.map((m) => this.toWireMessage(m)),
      temperature: options.temperature ?? 0.7,
    };
    if (options.tools?.length) {
      body.tools = options.tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
      body.tool_choice = 'auto';
    }
    if (options.jsonMode) body.response_format = { type: 'json_object' };

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      const reason = err instanceof Error && err.name === 'TimeoutError' ? 'timeout' : 'falha de rede';
      throw new LlmProviderError(this.name, `Requisição falhou (${reason}).`);
    }

    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 300);
      const hint = response.status === 401 || response.status === 403 ? ' Verifique a API key.' : '';
      throw new LlmProviderError(this.name, `HTTP ${response.status}.${hint} ${detail}`.trim(), response.status);
    }

    const data = (await response.json()) as OpenAIChatResponse;
    const message = data.choices?.[0]?.message;
    if (!message) throw new LlmProviderError(this.name, 'Resposta sem "choices".');

    const toolCalls: ToolCall[] = (message.tool_calls ?? [])
      .filter((tc) => tc.function?.name)
      .map((tc) => {
        const id = tc.id || `call_${randomUUID()}`;
        return {
          id,
          name: tc.function!.name!,
          arguments: tc.function!.arguments ?? '{}',
          raw: { ...tc, id, type: tc.type ?? 'function' },
        };
      });

    return { content: message.content ?? null, toolCalls };
  }

  private toWireMessage(m: ChatMessage): Record<string, unknown> {
    switch (m.role) {
      case 'assistant':
        return m.toolCalls?.length
          ? { role: 'assistant', content: m.content ?? '', tool_calls: m.toolCalls.map((tc) => this.toWireToolCall(tc)) }
          : { role: 'assistant', content: m.content ?? '' };
      case 'tool':
        return { role: 'tool', tool_call_id: m.toolCallId, name: m.name, content: m.content };
      default:
        return { role: m.role, content: m.content };
    }
  }

  /** Reaproveita o objeto original se veio de um provedor OpenAI-like; senão (ex.: fallback após Anthropic), reconstrói. */
  private toWireToolCall(tc: ToolCall): Record<string, unknown> {
    if ('function' in tc.raw) return tc.raw;
    return { id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.arguments } };
  }
}
