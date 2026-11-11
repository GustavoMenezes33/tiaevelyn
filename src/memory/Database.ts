import fs from 'node:fs';
import path from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import { Logger } from '../utils/Logger.js';

/**
 * Singleton da conexão SQLite. Cria o schema no startup e ativa WAL.
 */
export class Database {
  private static instance: Database | null = null;
  private readonly logger = new Logger('Database');
  readonly connection: BetterSqlite3.Database;

  private constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.connection = new BetterSqlite3(dbPath, { timeout: 5000 });
    this.connection.pragma('journal_mode = WAL');
    this.connection.pragma('synchronous = NORMAL');
    this.connection.pragma('foreign_keys = OFF');
    this.migrate();
    this.logger.info(`SQLite pronto em ${dbPath} (WAL ativo).`);
  }

  static getInstance(dbPath: string): Database {
    if (!Database.instance) Database.instance = new Database(dbPath);
    return Database.instance;
  }

  close(): void {
    this.connection.close();
    Database.instance = null;
  }

  private migrate(): void {
    this.connection.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL,
        provider   TEXT NOT NULL,
        is_active  INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, is_active);

      CREATE TABLE IF NOT EXISTS messages (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
        content         TEXT NOT NULL,
        created_at      TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, id);

      CREATE TABLE IF NOT EXISTS student_profiles (
        user_id         TEXT PRIMARY KEY,
        level           TEXT CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
        level_source    TEXT CHECK (level_source IN ('nivelamento', 'observacao', 'manual')),
        frequent_errors TEXT NOT NULL DEFAULT '[]',
        studied_topics  TEXT NOT NULL DEFAULT '[]',
        pending_skill   TEXT,
        pending_since   TEXT,
        updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS vocabulary (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    TEXT NOT NULL,
        term       TEXT NOT NULL,
        meaning    TEXT NOT NULL,
        example    TEXT,
        source     TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (user_id, term COLLATE NOCASE)
      );
    `);
    this.addMissingColumns('student_profiles', {
      goals: "TEXT NOT NULL DEFAULT '[]'",
      interests: "TEXT NOT NULL DEFAULT '[]'",
    });
  }

  /** Bancos criados por versões anteriores ganham as colunas novas sem perder dados. */
  private addMissingColumns(table: string, columns: Record<string, string>): void {
    const existing = new Set(
      (this.connection.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name),
    );
    for (const [name, definition] of Object.entries(columns)) {
      if (!existing.has(name)) this.connection.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
    }
  }
}
