import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, StatementSync } from 'node:sqlite';
import { DbClient, DbPreparedStatement, DbResult } from './types.ts';

class LocalPreparedStatement implements DbPreparedStatement {
  private readonly db: DatabaseSync;
  private readonly sql: string;
  private params: unknown[] = [];

  constructor(db: DatabaseSync, sql: string, params: unknown[] = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...values: unknown[]): DbPreparedStatement {
    return new LocalPreparedStatement(
      this.db,
      this.sql,
      values.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v))
    );
  }

  private getStmt(): StatementSync {
    return this.db.prepare(this.sql);
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const stmt = this.getStmt();
    const row = stmt.get(...(this.params as Array<string | number | null | Uint8Array>));
    return (row as T | undefined) ?? null;
  }

  async all<T = Record<string, unknown>>(): Promise<DbResult<T>> {
    const stmt = this.getStmt();
    const rows = stmt.all(...(this.params as Array<string | number | null | Uint8Array>));
    return {
      results: rows as T[],
      success: true,
    };
  }

  async run(): Promise<DbResult> {
    const stmt = this.getStmt();
    const info = stmt.run(...(this.params as Array<string | number | null | Uint8Array>));
    return {
      results: [],
      success: true,
      meta: {
        changes: Number(info.changes ?? 0),
        last_row_id: Number(info.lastInsertRowid ?? 0),
      },
    };
  }
}

export class LocalSqliteD1Adapter implements DbClient {
  private readonly db: DatabaseSync;

  constructor(dbFilePath: string) {
    const dir = path.dirname(dbFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new DatabaseSync(dbFilePath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
  }

  runMigrations(migrationsDir: string) {
    if (!fs.existsSync(migrationsDir)) return;
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      this.db.exec(sql);
    }
  }

  prepare(sql: string): DbPreparedStatement {
    return new LocalPreparedStatement(this.db, sql);
  }

  async batch(statements: DbPreparedStatement[]): Promise<DbResult[]> {
    const results: DbResult[] = [];
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      for (const stmt of statements) {
        results.push(await stmt.run());
      }
      this.db.exec('COMMIT;');
      return results;
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }
}

let cachedAdapter: LocalSqliteD1Adapter | null = null;

export function getLocalSqliteDb(): LocalSqliteD1Adapter {
  if (cachedAdapter) return cachedAdapter;
  const dbPath = path.resolve(process.cwd(), 'data', 'furex.db');
  const adapter = new LocalSqliteD1Adapter(dbPath);
  adapter.runMigrations(path.resolve(process.cwd(), 'migrations'));
  cachedAdapter = adapter;
  return adapter;
}
