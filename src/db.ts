import { createClient } from '@libsql/client/web';
import type { Client, ResultSet, Value } from '@libsql/client/web';
import type { Env } from './types';

export type BindValue = string | number | null;

export type SqlRow = Record<string, Value>;

export interface SyncStatement {
  bind(...args: BindValue[]): SyncStatement;
  first<T = SqlRow>(): Promise<T | null>;
  run(): Promise<void>;
  all<T = SqlRow>(): Promise<{ results: T[] }>;
}

export interface SyncDb {
  prepare(sql: string): SyncStatement;
  batch<T = SqlRow>(statements: SyncStatement[]): Promise<{ results: T[] }[]>;
}

function plainRowsFromResult(res: ResultSet): SqlRow[] {
  const { columns, rows } = res;
  return rows.map(row => {
    const plain: SqlRow = {};
    for (let i = 0; i < columns.length; i++) {
      plain[columns[i]] = row[i];
    }
    return plain;
  });
}

class LibsqlStatement implements SyncStatement {
  constructor(
    private readonly client: Client,
    readonly sql: string,
    readonly args: BindValue[] = [],
  ) {}

  bind(...args: BindValue[]): LibsqlStatement {
    return new LibsqlStatement(this.client, this.sql, args);
  }

  private async query(): Promise<SqlRow[]> {
    const res = await this.client.execute({ sql: this.sql, args: this.args });
    return plainRowsFromResult(res);
  }

  async first<T = SqlRow>(): Promise<T | null> {
    const rows = await this.query();
    // SAFETY: the caller names the column shape of the statement it prepared.
    return (rows[0] as T | undefined) ?? null;
  }

  async run(): Promise<void> {
    await this.client.execute({ sql: this.sql, args: this.args });
  }

  async all<T = SqlRow>(): Promise<{ results: T[] }> {
    const rows = await this.query();
    // SAFETY: the caller names the column shape of the statement it prepared.
    return { results: rows as T[] };
  }
}

class LibsqlDb implements SyncDb {
  constructor(private readonly client: Client) {}

  prepare(sql: string): SyncStatement {
    return new LibsqlStatement(this.client, sql);
  }

  async batch<T = SqlRow>(
    statements: SyncStatement[],
  ): Promise<{ results: T[] }[]> {
    // SAFETY: prepare() is the only source of a SyncStatement and returns LibsqlStatement.
    const stmts = (statements as LibsqlStatement[]).map(s => ({
      sql: s.sql,
      args: s.args,
    }));
    const results = await this.client.batch(stmts, 'write');
    // SAFETY: the caller names the column shape of the statements it prepared.
    return results.map(res => ({ results: plainRowsFromResult(res) as T[] }));
  }
}

let singleton: { key: string; db: SyncDb } | undefined;

export function getDb(env: Env): SyncDb {
  const url = env.TURSO_DATABASE_URL?.replace(/^libsql:\/\//, 'https://');
  if (!url) {
    throw new Error('TURSO_DATABASE_URL is not set');
  }
  const key = `${url}\0${env.TURSO_AUTH_TOKEN ?? ''}`;
  if (singleton?.key === key) {
    return singleton.db;
  }
  const db = new LibsqlDb(
    createClient({ url, authToken: env.TURSO_AUTH_TOKEN }),
  );
  singleton = { key, db };
  return db;
}
