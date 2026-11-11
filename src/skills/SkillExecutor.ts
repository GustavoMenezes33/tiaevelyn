import type { AgentLoop, AgentLoopResult } from '../core/AgentLoop.js';
import type { ChatMessage } from '../llm/ILlmProvider.js';
import type { ToolExecutionContext } from '../tools/BaseTool.js';
import type { SkillLoader, SkillMetadata } from './SkillLoader.js';
import type { StudentContext } from '../memory/MemoryManager.js';
import { Logger } from '../utils/Logger.js';

export interface SkillExecutionRequest {
  skill: SkillMetadata | null;
  availableSkills: SkillMetadata[];
  history: ChatMessage[];
  context: ToolExecutionContext;
  audioReply: boolean;
  studentName?: string;
  student?: StudentContext;
}

/**
 * Injeta as instruções completas da skill escolhida (runtime injection) e
 * dispara o AgentLoop. O conteúdo da skill vale apenas para esta requisição.
 */
export class SkillExecutor {
  private readonly logger = new Logger('SkillExecutor');

  constructor(
    private readonly loader: SkillLoader,
    private readonly loop: AgentLoop,
  ) {}

  async execute(request: SkillExecutionRequest): Promise<AgentLoopResult> {
    let skillContent: string | null = null;
    if (request.skill) {
      try {
        skillContent = this.loader.loadContent(request.skill);
        this.logger.info(`Executando com skill "${request.skill.name}" (${skillContent.length} chars).`);
      } catch (err) {
        this.logger.warn(`Não foi possível ler a skill "${request.skill.name}"; seguindo sem ela.`, err);
      }
    }

    return this.loop.run({
      history: request.history,
      skillName: request.skill?.name ?? null,
      skillContent,
      availableSkills: request.availableSkills,
      context: request.context,
      audioReply: request.audioReply,
      studentName: request.studentName,
      student: request.student,
    });
  }
}
