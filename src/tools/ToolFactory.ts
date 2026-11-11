import { ToolRegistry } from './ToolRegistry.js';
import { CreateFileTool } from './CreateFileTool.js';
import { CurrentDateTimeTool } from './CurrentDateTimeTool.js';
import { UpdateStudentProfileTool, type StudentProfileStore } from './UpdateStudentProfileTool.js';
import { RegisterVocabularyTool, type VocabularyStore } from './RegisterVocabularyTool.js';
import type { TempFiles } from '../utils/TempFiles.js';

/** Factory que instancia e registra as ferramentas padrão do agente. */
export class ToolFactory {
  constructor(
    private readonly tempFiles: TempFiles,
    private readonly student: StudentProfileStore & VocabularyStore,
  ) {}

  createRegistry(): ToolRegistry {
    return new ToolRegistry()
      .register(new CreateFileTool(this.tempFiles))
      .register(new CurrentDateTimeTool())
      .register(new UpdateStudentProfileTool(this.student))
      .register(new RegisterVocabularyTool(this.student));
  }
}
