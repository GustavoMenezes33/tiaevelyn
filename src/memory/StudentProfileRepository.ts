import type BetterSqlite3 from 'better-sqlite3';

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];
/** De onde veio o nível: teste, percepção da Tia Evelyn nas conversas ou definido pelo aluno. */
export type LevelSource = 'nivelamento' | 'observacao' | 'manual';

export interface StudentProfile {
  userId: string;
  level: CefrLevel | null;
  levelSource: LevelSource | null;
  frequentErrors: string[];
  studiedTopics: string[];
  /** Por que estuda inglês (trabalho, viagem, prova...). */
  goals: string[];
  /** Assuntos de que gosta, para escolher temas de textos e exemplos. */
  interests: string[];
  pendingSkill: string | null;
  /** ISO (UTC) de quando a skill pendente começou a esperar resposta. */
  pendingSince: string | null;
  updatedAt: string;
}

export interface ProfilePatch {
  level?: CefrLevel;
  levelSource?: LevelSource;
  frequentErrors?: string[];
  studiedTopics?: string[];
  goals?: string[];
  interests?: string[];
}

interface ProfileRow {
  user_id: string;
  level: CefrLevel | null;
  level_source: LevelSource | null;
  frequent_errors: string;
  studied_topics: string;
  goals: string;
  interests: string;
  pending_skill: string | null;
  pending_since: string | null;
  updated_at: string;
}

/** Acesso à tabela `student_profiles`. */
export class StudentProfileRepository {
  constructor(private readonly db: BetterSqlite3.Database) {}

  find(userId: string): StudentProfile | null {
    const row = this.db.prepare('SELECT * FROM student_profiles WHERE user_id = ?').get(userId) as ProfileRow | undefined;
    return row ? StudentProfileRepository.toProfile(row) : null;
  }

  update(userId: string, patch: ProfilePatch): void {
    this.ensure(userId);
    this.db
      .prepare(
        `UPDATE student_profiles SET
           level           = COALESCE(?, level),
           level_source    = COALESCE(?, level_source),
           frequent_errors = COALESCE(?, frequent_errors),
           studied_topics  = COALESCE(?, studied_topics),
           goals           = COALESCE(?, goals),
           interests       = COALESCE(?, interests),
           updated_at      = datetime('now')
         WHERE user_id = ?`,
      )
      .run(
        patch.level ?? null,
        patch.levelSource ?? null,
        patch.frequentErrors ? JSON.stringify(patch.frequentErrors) : null,
        patch.studiedTopics ? JSON.stringify(patch.studiedTopics) : null,
        patch.goals ? JSON.stringify(patch.goals) : null,
        patch.interests ? JSON.stringify(patch.interests) : null,
        userId,
      );
  }

  setPendingSkill(userId: string, skillName: string | null): void {
    this.ensure(userId);
    this.db
      .prepare('UPDATE student_profiles SET pending_skill = ?, pending_since = ? WHERE user_id = ?')
      .run(skillName, skillName ? new Date().toISOString() : null, userId);
  }

  private ensure(userId: string): void {
    this.db.prepare('INSERT OR IGNORE INTO student_profiles (user_id) VALUES (?)').run(userId);
  }

  private static toProfile(row: ProfileRow): StudentProfile {
    return {
      userId: row.user_id,
      level: row.level,
      levelSource: row.level_source,
      frequentErrors: StudentProfileRepository.parseList(row.frequent_errors),
      studiedTopics: StudentProfileRepository.parseList(row.studied_topics),
      goals: StudentProfileRepository.parseList(row.goals),
      interests: StudentProfileRepository.parseList(row.interests),
      pendingSkill: row.pending_skill,
      pendingSince: row.pending_since,
      updatedAt: row.updated_at,
    };
  }

  private static parseList(json: string): string[] {
    try {
      const value: unknown = JSON.parse(json);
      return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
    } catch {
      return [];
    }
  }
}
