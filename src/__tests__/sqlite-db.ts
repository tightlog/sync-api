import type { Client, Row } from '@libsql/client';
import { createClient } from '@libsql/client';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BindValue, SqlRow, SyncDb, SyncStatement } from '../db';

function toPlain(columns: string[], row: Row): SqlRow {
  const plain: SqlRow = {};
  for (const [i, col] of columns.entries()) {
    plain[col] = row[i];
  }
  return plain;
}

export function adaptClient(client: Client): SyncDb {
  const statement = (sql: string, args: BindValue[] = []): SyncStatement => ({
    bind: (...next: BindValue[]) => statement(sql, next),
    run: async () => {
      await client.execute({ sql, args });
    },

    first: async <T>() => {
      const res = await client.execute({ sql, args });
      const row = res.rows[0];
      return row ? (toPlain(res.columns, row) as T) : null;
    },

    all: async <T>() => {
      const res = await client.execute({ sql, args });
      return {
        results: res.rows.map(row => toPlain(res.columns, row) as T),
      };
    },
  });
  return {
    prepare: sql => statement(sql),
    batch: async <T>(statements: SyncStatement[]) => {
      const results: { results: T[] }[] = [];
      await client.execute('BEGIN');
      try {
        for (const s of statements) {
          results.push(await s.all<T>());
        }
        await client.execute('COMMIT');
      } catch (error) {
        await client.execute('ROLLBACK');
        throw error;
      }
      return results;
    },
  };
}

const MIGRATIONS_DIR = join(import.meta.dirname, '..', '..', 'migrations');

export async function migratedDb(): Promise<{ client: Client; db: SyncDb }> {
  const client = createClient({ url: ':memory:' });
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(name => name.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    await client.executeMultiple(sql);
  }
  return { client, db: adaptClient(client) };
}
