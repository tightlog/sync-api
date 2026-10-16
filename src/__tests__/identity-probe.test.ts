import type { Client } from '@libsql/client';
import { beforeEach, describe, expect, test } from 'vitest';
import { SyncRepo } from '../repo';
import type { IdentitySummary } from '../repo';
import { catchRow } from './__fixtures__/catchRow.fixture';
import { migratedDb } from './sqlite-db';

const KEY = 'a'.repeat(64);
const TYPO_KEY = `${'a'.repeat(63)}b`;
const OTHER_KEY = 'c'.repeat(64);

let client: Client;
let repo: SyncRepo;

beforeEach(async () => {
  const migrated = await migratedDb();
  client = migrated.client;
  repo = new SyncRepo(migrated.db);
});

describe('SyncRepo.getIdentitySummary', () => {
  test('reports an unknown key as unknown', async () => {
    expect(await repo.getIdentitySummary(KEY)).toEqual<IdentitySummary>({
      known: false,
      catches: 0,
    });
  });

  test('does not create the identity it was asked about', async () => {
    await repo.getIdentitySummary(KEY);

    const count = await client.execute('SELECT COUNT(*) FROM users');
    expect(Number(count.rows[0][0])).toBe(0);
  });

  test('reports a known key with its live catch count', async () => {
    await repo.upsertRows('catches', KEY, [
      catchRow('c1', 1000),
      catchRow('c2', 1000),
    ]);

    expect(await repo.getIdentitySummary(KEY)).toEqual<IdentitySummary>({
      known: true,
      catches: 2,
    });
  });

  test('does not count soft-deleted catches', async () => {
    await repo.upsertRows('catches', KEY, [
      catchRow('c1', 1000),
      catchRow('c2', 2000, { deletedAt: '2026-08-19T00:00:00.000Z' }),
    ]);

    expect(await repo.getIdentitySummary(KEY)).toEqual<IdentitySummary>({
      known: true,
      catches: 1,
    });
  });

  test('a one-character typo of a real key reads as unknown', async () => {
    await repo.upsertRows('catches', KEY, [catchRow('c1', 1000)]);

    expect(await repo.getIdentitySummary(TYPO_KEY)).toEqual<IdentitySummary>({
      known: false,
      catches: 0,
    });
  });

  test('does not leak the catches of another identity', async () => {
    await repo.upsertRows('catches', KEY, [catchRow('c1', 1000)]);
    await repo.upsertRows('catches', OTHER_KEY, [
      catchRow('c2', 1000),
      catchRow('c3', 1000),
    ]);

    expect(await repo.getIdentitySummary(KEY)).toEqual<IdentitySummary>({
      known: true,
      catches: 1,
    });
  });
});
