import type { Client } from '@libsql/client';
import { beforeEach, describe, expect, test } from 'vitest';
import type { SyncDb } from '../db';
import { SyncRepo } from '../repo';
import { migratedDb } from './sqlite-db';

const RC = '$RCAnonymousID:8f3c2b1a4d5e6f708192a3b4c5d6e7f8';

let client: Client;
let db: SyncDb;
let repo: SyncRepo;

beforeEach(async () => {
  ({ client, db } = await migratedDb());
  repo = new SyncRepo(db);
});

async function addUser(id: string): Promise<void> {
  await client.execute({
    sql: 'INSERT INTO users (id, key_hash) VALUES (?, ?)',
    args: [id, id],
  });
}

describe('SyncRepo.claimRevenueCatId', () => {
  test('the first identity to present a customer keeps it', async () => {
    await addUser('H1');
    await repo.claimRevenueCatId('H1', RC).run();

    const owner = await repo.getUserByRevenueCatId(RC);
    expect(owner?.id).toBe('H1');
  });

  test('a reinstall re-presenting the same customer does not throw', async () => {
    await addUser('H1');
    await repo.claimRevenueCatId('H1', RC).run();

    await addUser('H2');
    await expect(
      repo.claimRevenueCatId('H2', RC).run(),
    ).resolves.toBeUndefined();
  });

  test('the customer still points at the original logbook after a reinstall', async () => {
    await addUser('H1');
    await repo.claimRevenueCatId('H1', RC).run();
    await addUser('H2');
    await repo.claimRevenueCatId('H2', RC).run();

    const owner = await repo.getUserByRevenueCatId(RC);
    expect(owner?.id).toBe('H1');
  });

  test('re-claiming for the same identity is idempotent', async () => {
    await addUser('H1');
    await repo.claimRevenueCatId('H1', RC).run();
    await repo.claimRevenueCatId('H1', RC).run();

    const owner = await repo.getUserByRevenueCatId(RC);
    expect(owner?.id).toBe('H1');
  });

  test('an identity with no prior claim still takes a free customer', async () => {
    await addUser('H1');
    await addUser('H2');
    await repo.claimRevenueCatId('H1', RC).run();
    await repo.claimRevenueCatId('H2', '$RCAnonymousID:0000000000000000').run();

    expect((await repo.getUserByRevenueCatId(RC))?.id).toBe('H1');
    expect(
      (await repo.getUserByRevenueCatId('$RCAnonymousID:0000000000000000'))?.id,
    ).toBe('H2');
  });
});
