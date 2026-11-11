/** Chamada de ferramenta solicitada pelo LLM. */
export interface ToolCall {
  id: string;
  name: string;
  /** Argumentos crus (string JSON) exatamente como o LLM enviou. */
  arguments: string;
  /** Objeto original do provedor, devolvido intacto no histórico (ex.: assinaturas do Gemini). */
  raw: Record<string, unknown>;
}

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | {
      role: 'assistant';
      content: string | null;
      toolCalls?: ToolCall[];
      /** Conteúdo original do provedor que gerou a mensagem (ex.: blocos de thinking da Anthropic). */
      raw?: { provider: string; content: unknown };
    }
  | { role: 'tool'; content: string; toolCallId: string; name: string };

/** Definição de ferramenta exposta ao LLM (JSON Schema). */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatOptions {
  tools?: ToolDefinition[];
  /** Força a resposta a ser um objeto JSON. */
  jsonMode?: boolean;
  /** JSON Schema da resposta (provedores com saída estruturada o aplicam; os demais usam só `jsonMode`). */
  jsonSchema?: Record<string, unknown>;
  temperature?: number;
  /** Profundidade de raciocínio, para provedores que suportam (Anthropic). */
  effort?: 'low' | 'medium' | 'high';
}

export interface LlmResponse {
  content: string | null;
  toolCalls: ToolCall[];
  /** Conteúdo original a ser devolvido intacto na próxima chamada ao mesmo provedor. */
  raw?: { provider: string; content: unknown };
}

/** Contrato comum a todos os "cérebros" (Gemini, DeepSeek, Groq...). */
export interface ILlmProvider {
  readonly name: string;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<LlmResponse>;
}

/** Erro de provedor sem detalhes sensíveis (nunca inclui API keys). */
export class LlmProviderError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    readonly status?: number,
  ) {
    super(`[${provider}] ${message}`);
    this.name = 'LlmProviderError';
  }
}
