import Anthropic from '@anthropic-ai/sdk';
import {
  LlmProviderError,
  type ChatMessage,
  type ChatOptions,
  type ILlmProvider,
  type LlmResponse,
  type ToolCall,
} from './ILlmProvider.js';

type MessageParam = Anthropic.Beta.BetaMessageParam;
type ContentBlockParam = Anthropic.Beta.BetaContentBlockParam;
type ToolResultBlockParam = Anthropic.Beta.BetaToolResultBlockParam;

export type AnthropicEffort = 'low' | 'medium' | 'high';

/**
 * Claude via SDK oficial (`@anthropic-ai/sdk`, Messages API).
 * Converte o formato interno (estilo OpenAI) para system/tool_use/tool_result.
 */
export class AnthropicProvider implements ILlmProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic | null;

  constructor(
    apiKey: string,
    private readonly model: string,
    timeoutMs: number,
    private readonly defaultEffort: AnthropicEffort,
  ) {
    this.client = apiKey ? new Anthropic({ apiKey, timeout: timeoutMs }) : null;
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<LlmResponse> {
    if (!this.client) throw new LlmProviderError(this.name, 'API key não configurada.');

    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');

    const outputConfig: Anthropic.Beta.BetaOutputConfig = { effort: options.effort ?? this.defaultEffort };
    if (options.jsonSchema) outputConfig.format = { type: 'json_schema', schema: options.jsonSchema };

    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 16000,
        ...(system ? { system } : {}),
        messages: this.toWireMessages(messages),
        ...(options.tools?.length
          ? {
              tools: options.tools.map((t) => ({
                name: t.name,
                description: t.description,
                input_schema: t.parameters as Anthropic.Beta.BetaTool.InputSchema,
              })),
            }
          : {}),
        output_config: outputConfig,
        // Recusa dos filtros de segurança -> a própria API refaz o pedido no modelo recomendado.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        // Cache automático do prefixo (tools + system + histórico) entre iterações do ReAct.
        cache_control: { type: 'ephemeral' },
      });
    } catch (err) {
      throw AnthropicProvider.toProviderError(err);
    }

    if (response.stop_reason === 'refusal') {
      const category = response.stop_details?.category ?? 'sem categoria';
      throw new LlmProviderError(this.name, `Pedido recusado pelos filtros de segurança (${category}).`);
    }

    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    const toolCalls: ToolCall[] = response.content
      .filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
      .map((b) => ({
        id: b.id,
        name: b.name,
        arguments: JSON.stringify(b.input ?? {}),
        raw: b as unknown as Record<string, unknown>,
      }));

    // O conteúdo completo (inclui blocos de thinking) precisa voltar intacto na próxima iteração.
    return { content: text || null, toolCalls, raw: { provider: this.name, content: response.content } };
  }

  /** Converte o histórico interno para o formato da Messages API. */
  private toWireMessages(messages: ChatMessage[]): MessageParam[] {
    const wire: MessageParam[] = [];
    let pendingResults: ToolResultBlockParam[] = [];

    const flushResults = () => {
      // Todos os tool_result de uma rodada vão juntos numa única mensagem do usuário.
      if (pendingResults.length) wire.push({ role: 'user', content: pendingResults });
      pendingResults = [];
    };

    for (const m of messages) {
      if (m.role === 'system') continue;

      if (m.role === 'tool') {
        pendingResults.push({
          type: 'tool_result',
          tool_use_id: m.toolCallId,
          content: m.content,
          ...(m.content.startsWith('{"error"') ? { is_error: true } : {}),
        });
        continue;
      }

      flushResults();
      if (m.role !== 'assistant') {
        wire.push({ role: 'user', content: m.content });
      } else if (m.raw?.provider === this.name) {
        wire.push({ role: 'assistant', content: m.raw.content as ContentBlockParam[] });
      } else {
        wire.push({ role: 'assistant', content: AnthropicProvider.rebuildAssistant(m) });
      }
    }
    flushResults();
    return wire;
  }

  /** Reconstrói a mensagem do assistente vinda de outro provedor (ex.: após fallback). */
  private static rebuildAssistant(m: Extract<ChatMessage, { role: 'assistant' }>): ContentBlockParam[] {
    const blocks: ContentBlockParam[] = [];
    if (m.content) blocks.push({ type: 'text', text: m.content });
    for (const tc of m.toolCalls ?? []) {
      let input: unknown = {};
      try {
        input = JSON.parse(tc.arguments || '{}');
      } catch {
        // Argumentos inválidos já foram reportados ao modelo como Observation.
      }
      blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input });
    }
    return blocks.length ? blocks : [{ type: 'text', text: '(sem conteúdo)' }];
  }

  private static toProviderError(err: unknown): LlmProviderError {
    if (err instanceof Anthropic.AuthenticationError) {
      return new LlmProviderError('anthropic', 'API key inválida.', err.status);
    }
    if (err instanceof Anthropic.RateLimitError) {
      return new LlmProviderError('anthropic', 'Limite de requisições atingido (429).', err.status);
    }
    if (err instanceof Anthropic.APIConnectionTimeoutError) {
      return new LlmProviderError('anthropic', 'Requisição falhou (timeout).');
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return new LlmProviderError('anthropic', 'Requisição falhou (falha de rede).');
    }
    if (err instanceof Anthropic.APIError) {
      return new LlmProviderError('anthropic', `HTTP ${err.status}. ${err.message}`.slice(0, 400), err.status);
    }
    return new LlmProviderError('anthropic', err instanceof Error ? err.message : String(err));
  }
}
