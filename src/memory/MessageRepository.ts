import type BetterSqlite3 from 'better-sqlite3';

export type StoredRole = 'user' | 'assistant' | 'system' | 'tool';

export interface StoredMessage {
  id: number;
  conversation_id: string;
  role: StoredRole;
  content: string;
  created_at: string;
}

/** Acesso à tabela `messages`. */
export class MessageRepository {
  constructor(private readonly db: BetterSqlite3.Database) {}

  insert(conversationId: string, role: StoredRole, content: string): void {
    this.db
      .prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)')
      .run(conversationId, role, content);
  }

  /** Retorna as últimas `limit` mensagens das roles pedidas, em ordem cronológica. */
  findRecent(conversationId: string, limit: number, roles: StoredRole[]): StoredMessage[] {
    const placeholders = roles.map(() => '?').join(', ');
    const rows = this.db
      .prepare(
        `SELECT * FROM messages WHERE conversation_id = ? AND role IN (${placeholders}) ORDER BY id DESC LIMIT ?`,
      )
      .all(conversationId, ...roles, limit) as StoredMessage[];
    return rows.reverse();
  }

  /** Mensagens de uma role com id a partir de `minId`, em ordem cronológica. */
  findSince(conversationId: string, role: StoredRole, minId: number): StoredMessage[] {
    return this.db
      .prepare('SELECT * FROM messages WHERE conversation_id = ? AND role = ? AND id >= ? ORDER BY id')
      .all(conversationId, role, minId) as StoredMessage[];
  }
}
