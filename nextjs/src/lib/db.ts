import Database from 'better-sqlite3';
import path from 'path';

export interface DbRow { [key: string]: unknown }

export interface Db {
  all<T = DbRow>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T = DbRow>(sql: string, params?: unknown[]): Promise<T | undefined>;
  run(sql: string, params?: unknown[]): Promise<void>;
}

export function isUniqueConstraintError(e: unknown): boolean {
  if (e instanceof Error) {
    if (e.message.includes('UNIQUE constraint')) return true;
    if ('code' in e && (e as { code: string }).code === '23505') return true;
  }
  return false;
}

// Convert ? placeholders to $1, $2, ... for PostgreSQL
function toPostgresParams(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

const PG_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS learned_words (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    english TEXT NOT NULL,
    chinese TEXT NOT NULL,
    pinyin TEXT NOT NULL,
    UNIQUE(username, english)
  );
  CREATE TABLE IF NOT EXISTS settings (
    username TEXT PRIMARY KEY,
    manual_level INTEGER
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    created_at DOUBLE PRECISION NOT NULL
  );
`;

const SQLITE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS learned_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    english TEXT NOT NULL,
    chinese TEXT NOT NULL,
    pinyin TEXT NOT NULL,
    UNIQUE(username, english)
  );
  CREATE TABLE IF NOT EXISTS settings (
    username TEXT PRIMARY KEY,
    manual_level INTEGER
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    created_at REAL NOT NULL
  );
`;

async function createPostgresDb(connectionString: string): Promise<Db> {
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await pool.query(PG_SCHEMA);
  console.log('[db] Using PostgreSQL');

  return {
    async all<T = DbRow>(sql: string, params?: unknown[]): Promise<T[]> {
      const { rows } = await pool.query(toPostgresParams(sql), params);
      return rows as T[];
    },
    async get<T = DbRow>(sql: string, params?: unknown[]): Promise<T | undefined> {
      const { rows } = await pool.query(toPostgresParams(sql), params);
      return rows[0] as T | undefined;
    },
    async run(sql: string, params?: unknown[]): Promise<void> {
      await pool.query(toPostgresParams(sql), params);
    },
  };
}

function createSqliteDb(dbPath: string): Db {
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.exec(SQLITE_SCHEMA);
  console.log('[db] Using SQLite');

  return {
    async all<T = DbRow>(sql: string, params?: unknown[]): Promise<T[]> {
      return sqlite.prepare(sql).all(...(params ?? [])) as T[];
    },
    async get<T = DbRow>(sql: string, params?: unknown[]): Promise<T | undefined> {
      return sqlite.prepare(sql).get(...(params ?? [])) as T | undefined;
    },
    async run(sql: string, params?: unknown[]): Promise<void> {
      sqlite.prepare(sql).run(...(params ?? []));
    },
  };
}

let _db: Db | null = null;
let _init: Promise<Db> | null = null;

export async function getDb(): Promise<Db> {
  if (_db) return _db;
  if (_init) return _init;

  _init = (async () => {
    const url = process.env.DATABASE_URL;
    _db = url
      ? await createPostgresDb(url)
      : createSqliteDb(path.join(process.cwd(), 'app.db'));
    return _db;
  })();

  return _init;
}
