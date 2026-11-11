import type { ToolDefinition } from '../llm/ILlmProvider.js';

/** Arquivo gerado durante o processamento, a ser enviado ao usuário pelo Output. */
export interface OutputFile {
  path: string;
  filename: string;
}

/** Contexto disponível para as ferramentas durante uma execução do AgentLoop. */
export interface ToolExecutionContext {
  userId: string;
  conversationId: string;
  /** Arquivos que a ferramenta deseja enviar ao usuário ao fim do ciclo. */
  files: OutputFile[];
}

export interface ToolResult {
  output: string;
}

/** Classe base de toda ferramenta acionável pelo LLM (ReAct "Action"). */
export abstract class BaseTool {
  abstract readonly name: string;
  abstract readonly description: string;
  /** JSON Schema dos argumentos. */
  abstract readonly parameters: Record<string, unknown>;

  abstract execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult>;

  toDefinition(): ToolDefinition {
    return { name: this.name, description: this.description, parameters: this.parameters };
  }

  /** Lê um argumento string obrigatório, lançando erro legível para o LLM corrigir. */
  protected requireString(args: Record<string, unknown>, key: string): string {
    const value = args[key];
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`Argumento "${key}" é obrigatório e deve ser uma string não vazia.`);
    }
    return value;
  }
}
