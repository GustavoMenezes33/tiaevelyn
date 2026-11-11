import type BetterSqlite3 from 'better-sqlite3';

export interface VocabularyItem {
  term: string;
  meaning: string;
  example?: string;
}

/** Acesso à tabela `vocabulary` (o futuro review-srs agenda as revisões a partir dela). */
export class VocabularyRepository {
  constructor(private readonly db: BetterSqlite3.Database) {}

  /** Insere os termos novos; termos já registrados (sem diferenciar maiúsculas) são mantidos. Retorna quantos entraram. */
  add(userId: string, items: VocabularyItem[], source: string): number {
    const insert = this.db.prepare(
      'INSERT OR IGNORE INTO vocabulary (user_id, term, meaning, example, source) VALUES (?, ?, ?, ?, ?)',
    );
    const addAll = this.db.transaction((list: VocabularyItem[]) =>
      list.reduce((added, i) => added + insert.run(userId, i.term, i.meaning, i.example ?? null, source).changes, 0),
    );
    return addAll(items);
  }

  count(userId: string): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM vocabulary WHERE user_id = ?').get(userId) as { n: number }).n;
  }

  /** Termos mais recentes, do mais novo para o mais antigo. */
  recentTerms(userId: string, limit: number): string[] {
    return (
      this.db.prepare('SELECT term FROM vocabulary WHERE user_id = ? ORDER BY id DESC LIMIT ?').all(userId, limit) as {
        term: string;
      }[]
    ).map((r) => r.term);
  }
}
