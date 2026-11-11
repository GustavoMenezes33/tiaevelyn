import { BaseTool, type ToolExecutionContext, type ToolResult } from './BaseTool.js';
import {
  CEFR_LEVELS,
  type CefrLevel,
  type ProfilePatch,
  type StudentProfile,
} from '../memory/StudentProfileRepository.js';

/** O que a ferramenta precisa da memória (o MemoryManager atende). */
export interface StudentProfileStore {
  getProfile(userId: string): StudentProfile | null;
  updateProfile(userId: string, patch: ProfilePatch): StudentProfile;
}

const MAX_ERRORS = 6;
const MAX_TOPICS = 20;
const MAX_GOALS = 5;
const MAX_INTERESTS = 8;
const MAX_ITEM_CHARS = 80;

/** Grava o nível e os pontos de atenção do aluno no perfil persistente. */
export class UpdateStudentProfileTool extends BaseTool {
  readonly name = 'atualizar_perfil_aluno';
  readonly description =
    'Atualiza o perfil persistente do aluno: nível (QECR A1–C2), erros frequentes, temas já estudados, ' +
    'objetivos com o inglês e interesses pessoais. ' +
    'Use após o teste de nivelamento, ou quando houver evidência clara nas conversas. Envie só os campos que mudaram.';
  readonly parameters = {
    type: 'object',
    properties: {
      nivel: { type: 'string', enum: [...CEFR_LEVELS], description: 'Nível estimado do aluno.' },
      fonte: {
        type: 'string',
        enum: ['nivelamento', 'observacao'],
        description: '"nivelamento" se o nível veio do teste; "observacao" se veio das conversas.',
      },
      erros_frequentes: {
        type: 'array',
        items: { type: 'string' },
        description: `Lista COMPLETA e atualizada dos erros recorrentes (máx. ${MAX_ERRORS}), ex.: "3ª pessoa do singular (he go)".`,
      },
      temas_estudados: {
        type: 'array',
        items: { type: 'string' },
        description: 'Temas novos a acrescentar ao histórico, ex.: "present perfect".',
      },
      objetivos: {
        type: 'array',
        items: { type: 'string' },
        description: `Lista COMPLETA dos objetivos do aluno com o inglês (máx. ${MAX_GOALS}), ex.: "reuniões em inglês no trabalho".`,
      },
      interesses: {
        type: 'array',
        items: { type: 'string' },
        description: `Lista COMPLETA dos assuntos de que o aluno gosta (máx. ${MAX_INTERESTS}), ex.: "futebol", "tecnologia".`,
      },
    },
  };

  constructor(private readonly store: StudentProfileStore) {
    super();
  }

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const current = this.store.getProfile(context.userId);
    const patch: ProfilePatch = {};
    const notes: string[] = [];

    if (args.nivel !== undefined) {
      if (!CEFR_LEVELS.includes(args.nivel as CefrLevel)) {
        throw new Error(`"nivel" deve ser um de: ${CEFR_LEVELS.join(', ')}.`);
      }
      const source = args.fonte === 'nivelamento' ? 'nivelamento' : 'observacao';
      // O nível escolhido pelo aluno só é substituído por um novo teste, não por impressões da conversa.
      if (current?.levelSource === 'manual' && source === 'observacao') {
        notes.push(`nível mantido em ${current.level} (definido pelo próprio aluno)`);
      } else {
        patch.level = args.nivel as CefrLevel;
        patch.levelSource = source;
      }
    }

    if (args.erros_frequentes !== undefined) {
      patch.frequentErrors = UpdateStudentProfileTool.cleanList(args.erros_frequentes, 'erros_frequentes').slice(0, MAX_ERRORS);
    }

    if (args.temas_estudados !== undefined) {
      const added = UpdateStudentProfileTool.cleanList(args.temas_estudados, 'temas_estudados');
      const known = current?.studiedTopics ?? [];
      const merged = [...known.filter((t) => !added.some((a) => a.toLowerCase() === t.toLowerCase())), ...added];
      patch.studiedTopics = merged.slice(-MAX_TOPICS);
    }

    if (args.objetivos !== undefined) {
      patch.goals = UpdateStudentProfileTool.cleanList(args.objetivos, 'objetivos').slice(0, MAX_GOALS);
    }
    if (args.interesses !== undefined) {
      patch.interests = UpdateStudentProfileTool.cleanList(args.interesses, 'interesses').slice(0, MAX_INTERESTS);
    }

    if (!Object.keys(patch).length && !notes.length) {
      throw new Error('Nenhum campo para atualizar. Envie nivel, erros_frequentes, temas_estudados, objetivos ou interesses.');
    }

    const profile = Object.keys(patch).length ? this.store.updateProfile(context.userId, patch) : current;
    const summary = [
      `nível: ${profile?.level ?? 'desconhecido'}`,
      `erros frequentes: ${profile?.frequentErrors.join('; ') || 'nenhum'}`,
      `temas estudados: ${profile?.studiedTopics.length ?? 0}`,
      `objetivos: ${profile?.goals.join('; ') || 'nenhum'}`,
      `interesses: ${profile?.interests.join('; ') || 'nenhum'}`,
    ].join(' | ');
    return { output: `Perfil atualizado (${summary})${notes.length ? `. Observação: ${notes.join('; ')}.` : '.'}` };
  }

  private static cleanList(value: unknown, field: string): string[] {
    if (!Array.isArray(value)) throw new Error(`"${field}" deve ser uma lista de textos.`);
    return value
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.replace(/\s+/g, ' ').trim().slice(0, MAX_ITEM_CHARS))
      .filter(Boolean);
  }
}
