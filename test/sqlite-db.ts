import type { Client } from '@libsql/client';
import { createClient } from '@libsql/client';
import { libsqlDb } from '@tightlog/worker-utils/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SyncDb } from '../src/db';

const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'migrations');

export async function migratedDb(): Promise<{ client: Client; db: SyncDb }> {
  const client = createClient({ url: ':memory:' });
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(name => name.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    await client.executeMultiple(sql);
  }

  return { client, db: libsqlDb(client) };
}
