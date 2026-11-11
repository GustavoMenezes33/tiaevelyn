import type { ChatMessage, ILlmProvider, ToolCall } from '../llm/ILlmProvider.js';
import type { ToolExecutionContext } from '../tools/BaseTool.js';
import type { ToolRegistry } from '../tools/ToolRegistry.js';
import type { SkillMetadata } from '../skills/SkillLoader.js';
import type { SystemPromptBuilder } from './SystemPromptBuilder.js';
import type { StudentContext } from '../memory/MemoryManager.js';
import { Logger } from '../utils/Logger.js';

export interface AgentLoopRequest {
  history: ChatMessage[];
  skillName: string | null;
  skillContent: string | null;
  availableSkills: SkillMetadata[];
  context: ToolExecutionContext;
  audioReply?: boolean;
  studentName?: string;
  student?: StudentContext;
}

/** Uma ferramenta executada durante o loop (persistida como role "tool"). */
export interface ToolTrace {
  name: string;
  arguments: string;
  observation: string;
}

export interface AgentLoopResult {
  answer: string;
  iterations: number;
  toolTraces: ToolTrace[];
}

/** Lançado quando o loop atinge MAX_ITERATIONS sem resposta final. */
export class MaxIterationsError extends Error {
  constructor(
    readonly limit: number,
    readonly toolTraces: ToolTrace[] = [],
  ) {
    super(`AgentLoop atingiu o limite de ${limit} iterações.`);
    this.name = 'MaxIterationsError';
  }
}

const MAX_OBSERVATION_CHARS = 20_000;
/** A partir deste tamanho, texto escrito junto com uma ferramenta é conteúdo para o aluno, não narração. */
const MIN_DRAFT_CHARS = 280;

/**
 * Motor de raciocínio ReAct: Thought -> Action -> Observation -> ... -> Answer,
 * limitado por MAX_ITERATIONS.
 */
export class AgentLoop {
  private readonly logger = new Logger('AgentLoop');

  constructor(
    private readonly provider: ILlmProvider,
    private readonly tools: ToolRegistry,
    private readonly promptBuilder: SystemPromptBuilder,
    private readonly maxIterations: number,
  ) {}

  async run(request: AgentLoopRequest): Promise<AgentLoopResult> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: this.promptBuilder.build({
          skillName: request.skillName,
          skillContent: request.skillContent,
          availableSkills: request.availableSkills,
          audioReply: request.audioReply ?? false,
          studentName: request.studentName,
          student: request.student,
        }),
      },
      ...request.history,
    ];
    const toolDefinitions = this.tools.definitions();
    const toolTraces: ToolTrace[] = [];
    // Texto escrito junto com uma chamada de ferramenta: às vezes é a própria resposta
    // (ex.: a correção inteira antes de registrar o vocabulário), então não pode se perder.
    // Narração curta ("Vou criar o arquivo.") fica de fora.
    const drafts: string[] = [];

    for (let iteration = 1; iteration <= this.maxIterations; iteration++) {
      this.logger.info(`── Iteração ${iteration}/${this.maxIterations} (${this.provider.name})`);
      const response = await this.provider.chat(messages, { tools: toolDefinitions });

      if (response.toolCalls.length === 0) {
        const answer = [...drafts, response.content?.trim() ?? ''].filter(Boolean).join('\n\n');
        this.logger.info(`💬 Answer: ${AgentLoop.preview(answer)}`);
        return {
          answer: answer || 'Hmm, não consegui formular uma resposta. Pode reformular?',
          iterations: iteration,
          toolTraces,
        };
      }

      if (response.content?.trim()) {
        this.logger.info(`💭 Thought: ${AgentLoop.preview(response.content)}`);
        if (response.content.trim().length >= MIN_DRAFT_CHARS) drafts.push(response.content.trim());
      }
      messages.push({ role: 'assistant', content: response.content, toolCalls: response.toolCalls, raw: response.raw });

      // NG-02: tools executadas em sequência, na ordem pedida pelo LLM.
      for (const call of response.toolCalls) {
        this.logger.info(`🔧 Action: ${call.name}(${AgentLoop.preview(call.arguments, 200)})`);
        const observation = await this.executeTool(call, request.context);
        this.logger.info(`👁️ Observation: ${AgentLoop.preview(observation)}`);
        messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: observation });
        toolTraces.push({ name: call.name, arguments: call.arguments, observation });
      }
    }

    this.logger.warn(`Limite de ${this.maxIterations} iterações atingido.`);
    throw new MaxIterationsError(this.maxIterations, toolTraces);
  }

  /** Executa a ferramenta e sempre devolve uma Observation em texto (nunca lança). */
  private async executeTool(call: ToolCall, context: ToolExecutionContext): Promise<string> {
    const tool = this.tools.get(call.name);
    if (!tool) {
      return JSON.stringify({
        error: `Ferramenta "${call.name}" não existe. Disponíveis: ${this.tools.names().join(', ')}.`,
      });
    }

    let args: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(call.arguments || '{}');
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not an object');
      args = parsed as Record<string, unknown>;
    } catch {
      // EC-01: JSON malformado -> pede ao LLM para reenviar.
      return JSON.stringify({ error: 'JSON inválido nos argumentos, reenvie a estrutura corrigida por favor.' });
    }

    try {
      const result = await tool.execute(args, context);
      return result.output.slice(0, MAX_OBSERVATION_CHARS);
    } catch (err) {
      // EC-02: erro da ferramenta vira Observation para o LLM corrigir.
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  }

  private static preview(text: string, max = 300): string {
    const flat = text.replace(/\s+/g, ' ').trim();
    return flat.length > max ? `${flat.slice(0, max)}…` : flat;
  }
}
