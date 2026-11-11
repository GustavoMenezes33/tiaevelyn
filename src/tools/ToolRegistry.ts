import type { ToolDefinition } from '../llm/ILlmProvider.js';
import type { BaseTool } from './BaseTool.js';
import { Logger } from '../utils/Logger.js';

/** Registry das ferramentas disponíveis para o AgentLoop. */
export class ToolRegistry {
  private readonly logger = new Logger('ToolRegistry');
  private readonly tools = new Map<string, BaseTool>();

  register(tool: BaseTool): this {
    if (this.tools.has(tool.name)) this.logger.warn(`Ferramenta "${tool.name}" sobrescrita.`);
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  definitions(): ToolDefinition[] {
    return [...this.tools.values()].map((t) => t.toDefinition());
  }

  names(): string[] {
    return [...this.tools.keys()];
  }
}
