import { createClient } from '@libsql/client/web';
import type { Client, InValue, ResultSet, Value } from '@libsql/client/web';

export type SqlRow = Record<string, Value>;

export type BindValue = InValue;

export interface RunResult {
  meta: { changes: number };
}

export interface Statement {
  readonly sql: string;
  readonly args: InValue[];
  bind(...args: InValue[]): Statement;
  first<T = SqlRow>(): Promise<T | null>;
  run(): Promise<RunResult>;
  all<T = SqlRow>(): Promise<{ results: T[] }>;
}

export interface Db {
  prepare(sql: string): Statement;
  batch<T = SqlRow>(
    statements: Statement[],
  ): Promise<{ results: T[]; meta: { changes: number } }[]>;
}

export interface LibsqlEnv {
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
}

function plainRows({ columns, rows }: ResultSet): SqlRow[] {
  return rows.map(row => {
    const plain: SqlRow = {};
    for (let i = 0; i < columns.length; i++) {
      const column = columns[i];
      if (column === undefined) {
        continue;
      }

      plain[column] = row[i] ?? null;
    }

    return plain;
  });
}

class LibsqlStatement implements Statement {
  private readonly client: Client;
  readonly sql: string;
  readonly args: InValue[];

  constructor(client: Client, sql: string, args: InValue[] = []) {
    this.client = client;
    this.sql = sql;
    this.args = args;
  }

  bind(...args: InValue[]): LibsqlStatement {
    return new LibsqlStatement(this.client, this.sql, args);
  }

  private execute(): Promise<ResultSet> {
    return this.client.execute({ sql: this.sql, args: this.args });
  }

  async first<T = SqlRow>(): Promise<T | null> {
    const [row] = plainRows(await this.execute());
    // SAFETY: the caller names the column shape of the statement it prepared.
    return (row as T | undefined) ?? null;
  }

  async run(): Promise<RunResult> {
    return { meta: { changes: (await this.execute()).rowsAffected } };
  }

  async all<T = SqlRow>(): Promise<{ results: T[] }> {
    // SAFETY: the caller names the column shape of the statement it prepared.
    return { results: plainRows(await this.execute()) as T[] };
  }
}

class LibsqlDb implements Db {
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  prepare(sql: string): Statement {
    return new LibsqlStatement(this.client, sql);
  }

  async batch<T = SqlRow>(
    statements: Statement[],
  ): Promise<{ results: T[]; meta: { changes: number } }[]> {
    const results = await this.client.batch(
      statements.map(({ sql, args }) => ({ sql, args })),
      'write',
    );
    return results.map(res => ({
      // SAFETY: the caller names the column shape of the statements it prepared.
      results: plainRows(res) as T[],
      meta: { changes: res.rowsAffected },
    }));
  }
}

/**
 * Build one client per request. A client shared at module level queues
 * queries behind its concurrency limit, and Workers cannot resolve one
 * request's I/O from another request's context. The runtime then cancels
 * the waiting request as hung and Cloudflare returns a 500.
 */
export function libsqlDb(client: Client): Db {
  return new LibsqlDb(client);
}

export function createLibsqlDb(env: LibsqlEnv): Db {
  const url = env.TURSO_DATABASE_URL?.replace(/^libsql:\/\//, 'https://');
  if (!url) {
    throw new Error('TURSO_DATABASE_URL is not set');
  }

  return libsqlDb(createClient({ url, authToken: env.TURSO_AUTH_TOKEN }));
}
