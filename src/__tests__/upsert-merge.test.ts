import type { Client } from '@libsql/client';
import { beforeEach, describe, expect, test } from 'vitest';
import type { SyncDb } from '../db';
import { SyncRepo } from '../repo';
import { sanitizeRow, syncRowFromDb } from '../tables';
import { catchRow } from './__fixtures__/catchRow.fixture';
import { migratedDb } from './sqlite-db';

const KEY = 'a'.repeat(64);
const OTHER_KEY = 'b'.repeat(64);

let client: Client;
let db: SyncDb;
let repo: SyncRepo;

beforeEach(async () => {
  ({ client, db } = await migratedDb());
  repo = new SyncRepo(db);
});

async function speciesOf(id: string): Promise<string | null> {
  const res = await client.execute({
    sql: 'SELECT species FROM catches WHERE id = ?',
    args: [id],
  });

  return (res.rows[0]?.[0] as string) ?? null;
}

async function rowCount(table: string): Promise<number> {
  const res = await client.execute(`SELECT COUNT(*) FROM ${table}`);
  return Number(res.rows[0][0]);
}

async function lastSyncedAt(keyHash: string): Promise<string | null> {
  const res = await client.execute({
    sql: 'SELECT last_synced_at FROM users WHERE key_hash = ?',
    args: [keyHash],
  });
  return (res.rows[0]?.[0] as string | null) ?? null;
}

describe('the merge rule', () => {
  test('a first push creates the row and hands it back', async () => {
    const merged = await repo.upsertRows('catches', KEY, [
      catchRow('c1', 1000),
    ]);

    expect(merged.length).toBe(1);
    expect(syncRowFromDb('catches', merged[0]).species).toEqual('Tench');
    expect(await rowCount('catches')).toBe(1);
  });

  test('a newer push wins', async () => {
    await repo.upsertRows('catches', KEY, [catchRow('c1', 1000)]);

    await repo.upsertRows('catches', KEY, [
      catchRow('c1', 2000, { species: 'Bream' }),
    ]);

    expect(await speciesOf('c1')).toEqual('Bream');
  });

  test('an older push loses and gets the stored row back', async () => {
    await repo.upsertRows('catches', KEY, [
      catchRow('c1', 2000, { species: 'Bream' }),
    ]);

    const merged = await repo.upsertRows('catches', KEY, [
      catchRow('c1', 1000, { species: 'Stale' }),
    ]);

    expect(await speciesOf('c1')).toEqual('Bream');
    expect(syncRowFromDb('catches', merged[0]).species).toEqual('Bream');
  });

  test('an equal-stamp push loses the tie, so a replay cannot flip a value', async () => {
    await repo.upsertRows('catches', KEY, [
      catchRow('c1', 2000, { species: 'Bream' }),
    ]);

    await repo.upsertRows('catches', KEY, [
      catchRow('c1', 2000, { species: 'Other' }),
    ]);

    expect(await speciesOf('c1')).toEqual('Bream');
  });
});

describe('replaying a push', () => {
  test('the same batch sent twice leaves one row', async () => {
    const rows = [catchRow('c1', 1000), catchRow('c2', 1000)];

    await repo.upsertRows('catches', KEY, rows);
    await repo.upsertRows('catches', KEY, rows);

    expect(await rowCount('catches')).toBe(2);
  });

  test('a replay after a timeout returns the same winners', async () => {
    const rows = [catchRow('c1', 1000)];
    const first = await repo.upsertRows('catches', KEY, rows);

    const second = await repo.upsertRows('catches', KEY, rows);

    expect(syncRowFromDb('catches', second[0])).toEqual(
      syncRowFromDb('catches', first[0]),
    );
  });

  test('a soft-delete replayed does not resurrect the row', async () => {
    await repo.upsertRows('catches', KEY, [catchRow('c1', 1000)]);
    const softDelete = catchRow('c1', 2000, {
      deletedAt: '2026-08-19T10:00:00.000Z',
    });

    await repo.upsertRows('catches', KEY, [softDelete]);
    await repo.upsertRows('catches', KEY, [softDelete]);

    const res = await client.execute('SELECT deleted_at FROM catches');
    expect(res.rows.length).toBe(1);
    expect(res.rows[0][0]).toEqual('2026-08-19T10:00:00.000Z');
  });
});

describe('one identity cannot reach another', () => {
  test('the same row id under two keys stays two rows', async () => {
    await repo.upsertRows('catches', KEY, [
      catchRow('c1', 1000, { species: 'Mine' }),
    ]);

    await repo.upsertRows('catches', OTHER_KEY, [
      catchRow('c1', 5000, { species: 'Theirs' }),
    ]);

    expect(await rowCount('catches')).toBe(2);
    const { rows } = await repo.listSince('catches', KEY, 0);
    expect(rows.length).toBe(1);
    expect(rows[0].species).toEqual('Mine');
  });
});

describe('a push the Worker cannot store', () => {
  test('a row with no id is dropped before it reaches the database', () => {
    expect(sanitizeRow('catches', { id: '', updatedAt: 1000 })).toBeNull();
  });

  test('a row with no usable stamp is dropped', () => {
    expect(sanitizeRow('catches', { id: 'c1', updatedAt: 0 })).toBeNull();
    expect(sanitizeRow('catches', { id: 'c1', updatedAt: -1 })).toBeNull();
  });

  test('a dropped row is absent from the response', async () => {
    const merged = await repo.upsertRows('catches', KEY, [
      catchRow('c1', 1000),
    ]);

    expect(merged.map(row => row.id)).toEqual(['c1']);
  });
});

describe('large pushes', () => {
  test('returns every winner', async () => {
    const rows = Array.from({ length: 150 }, (_, i) =>
      catchRow(`row-${i}`, 1_000 + i),
    );

    const merged = await repo.upsertRows('catches', KEY, rows);

    expect(new Set(merged.map(row => row.id))).toEqual(
      new Set(rows.map(row => row.id)),
    );

    expect(await rowCount('catches')).toBe(150);
    expect(await lastSyncedAt(KEY)).not.toBeNull();
  });

  test('returns [] for an empty push without creating a user', async () => {
    const merged = await repo.upsertRows('catches', KEY, []);

    expect(merged).toEqual([]);
    expect(await rowCount('users')).toBe(0);
    expect(await rowCount('catches')).toBe(0);
  });
});
