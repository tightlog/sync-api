import { beforeEach, describe, expect, test } from 'vitest';
import { PULL_PAGE_SIZE, SyncRepo } from '../repo';
import { catchRow } from './__fixtures__/catchRow.fixture';
import { migratedDb } from './sqlite-db';

const KEY = 'a'.repeat(64);

let repo: SyncRepo;

beforeEach(async () => {
  const { db } = await migratedDb();
  repo = new SyncRepo(db);
});

describe('SyncRepo.listSince paging', () => {
  test('returns everything with a null cursor when under a page', async () => {
    await repo.upsertRows(
      'catches',
      KEY,
      Array.from({ length: 5 }, (_, i) => catchRow(`r${i}`, 100 + i)),
    );

    const { rows, nextSince } = await repo.listSince('catches', KEY, 0);

    expect(rows.map(row => row.id)).toEqual(['r0', 'r1', 'r2', 'r3', 'r4']);
    expect(nextSince).toBeNull();
  });

  test('only rows strictly newer than the cursor', async () => {
    await repo.upsertRows('catches', KEY, [
      catchRow('old', 100),
      catchRow('new', 200),
    ]);
    await repo.upsertRows('catches', 'b'.repeat(64), [catchRow('theirs', 300)]);

    const { rows, nextSince } = await repo.listSince('catches', KEY, 100);

    expect(rows.map(row => row.id)).toEqual(['new']);
    expect(nextSince).toBeNull();
  });

  test('never splits a boundary timestamp group across a page (F3)', async () => {
    const rows = [];
    for (let i = 1; i <= PULL_PAGE_SIZE - 1; i++) {
      rows.push(catchRow(`d${i}`, i));
    }

    const boundaryMs = PULL_PAGE_SIZE;
    for (const suffix of ['a', 'b', 'c']) {
      rows.push(catchRow(`boundary-${suffix}`, boundaryMs));
    }

    await repo.upsertRows('catches', KEY, rows);

    const { rows: catches, nextSince } = await repo.listSince(
      'catches',
      KEY,
      0,
    );

    expect(nextSince).toBe(boundaryMs);
    const ids = catches.map(row => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('boundary-a');
    expect(ids).toContain('boundary-b');
    expect(ids).toContain('boundary-c');
    expect(catches.length).toBe(PULL_PAGE_SIZE - 1 + 3);

    const { rows: rest } = await repo.listSince('catches', KEY, boundaryMs);
    expect(rest).toEqual([]);
  });

  test('an unknown key sees an empty page', async () => {
    await repo.upsertRows('catches', KEY, [catchRow('c1', 1000)]);

    const { rows, nextSince } = await repo.listSince(
      'catches',
      'b'.repeat(64),
      0,
    );
    expect(rows).toEqual([]);
    expect(nextSince).toBeNull();
  });
});
