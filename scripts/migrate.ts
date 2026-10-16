import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error('error: TURSO_DATABASE_URL is not set');
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'migrations');

const files = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.error(`error: no .sql migrations found in ${migrationsDir}`);
  process.exit(1);
}

const client = createClient({ url, authToken });

await client.execute(
  `CREATE TABLE IF NOT EXISTS _migrations (
     name TEXT PRIMARY KEY,
     applied_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,
);

const applied = new Set(
  (await client.execute('SELECT name FROM _migrations')).rows.map(
    row => row.name as string,
  ),
);

let count = 0;

for (const file of files) {
  if (applied.has(file)) {
    console.log(`skipping ${file} (already applied)`);
    continue;
  }

  const sql = readFileSync(join(migrationsDir, file), 'utf8');
  const statements = sql
    .replaceAll(/--[^\n]*/g, '')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);
  process.stdout.write(`applying ${file} ... `);
  await client.batch(
    [
      ...statements.map(s => ({ sql: s, args: [] })),
      { sql: 'INSERT INTO _migrations (name) VALUES (?)', args: [file] },
    ],
    'write',
  );
  console.log('ok');
  count += 1;
}

console.log(`applied ${count} new migration(s) to ${url}`);
