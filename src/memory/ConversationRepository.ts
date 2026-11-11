import { randomUUID } from 'node:crypto';
import type BetterSqlite3 from 'better-sqlite3';

export interface Conversation {
  id: string;
  user_id: string;
  provider: string;
  is_active: number;
  created_at: string;
}

/** Acesso à tabela `conversations`. */
export class ConversationRepository {
  constructor(private readonly db: BetterSqlite3.Database) {}

  findActiveByUser(userId: string): Conversation | undefined {
    return this.db
      .prepare('SELECT * FROM conversations WHERE user_id = ? AND is_active = 1 ORDER BY rowid DESC LIMIT 1')
      .get(userId) as Conversation | undefined;
  }

  create(userId: string, provider: string): Conversation {
    const id = randomUUID();
    this.db.prepare('INSERT INTO conversations (id, user_id, provider) VALUES (?, ?, ?)').run(id, userId, provider);
    return this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Conversation;
  }

  deactivateAllForUser(userId: string): void {
    this.db.prepare('UPDATE conversations SET is_active = 0 WHERE user_id = ?').run(userId);
  }
}
