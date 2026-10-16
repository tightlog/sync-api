import type { Client } from '@libsql/client';
import { beforeEach, describe, expect, test } from 'vitest';
import type { SyncDb } from '../db';
import { SyncRepo } from '../repo';
import { migratedDb } from './sqlite-db';

const OLD_KEY = 'a'.repeat(64);
const NEW_KEY = 'b'.repeat(64);

let client: Client;
let db: SyncDb;
let repo: SyncRepo;

beforeEach(async () => {
  ({ client, db } = await migratedDb());
  repo = new SyncRepo(db);
});

async function idsInTable(): Promise<string[]> {
  const res = await client.execute('SELECT id FROM users ORDER BY id');
  return res.rows.map(row => row[0] as string);
}

describe('SyncRepo.getOrCreateUser', () => {
  test('creates one row and returns it again for the same key', async () => {
    const first = await repo.getOrCreateUser(OLD_KEY);
    const second = await repo.getOrCreateUser(OLD_KEY);

    expect(second.id).toBe(first.id);
    expect(second.keyHash).toBe(OLD_KEY);
    expect(await idsInTable()).toHaveLength(1);
  });

  test('does not name the row after the key that created it', async () => {
    const user = await repo.getOrCreateUser(OLD_KEY);

    expect(user.id).not.toBe(OLD_KEY);
  });

  test('a device returning with a re-keyed-away key still gets served', async () => {
    const original = await repo.getOrCreateUser(OLD_KEY);

    const placeholder = await repo.getOrCreateUser(NEW_KEY);
    await repo.rekeyUser(original, NEW_KEY, placeholder.id);
    expect(await idsInTable()).toHaveLength(1);

    const returning = await repo.getOrCreateUser(OLD_KEY);

    expect(returning.id).not.toBe(original.id);
    expect(returning.keyHash).toBe(OLD_KEY);
    expect(await idsInTable()).toHaveLength(2);
  });

  test('the adopted identity keeps its id, so its media stays reachable', async () => {
    const original = await repo.getOrCreateUser(OLD_KEY);
    const placeholder = await repo.getOrCreateUser(NEW_KEY);
    await repo.rekeyUser(original, NEW_KEY, placeholder.id);

    const adopted = await repo.getOrCreateUser(NEW_KEY);
    expect(adopted.id).toBe(original.id);
  });
});

describe('SyncRepo.setKeyEscrow', () => {
  test('stores a ciphertext and stamps when it was written', async () => {
    const user = await repo.getOrCreateUser(OLD_KEY);

    await repo.setKeyEscrow(user.id, 'iv.ciphertext').run();

    const row = await client.execute({
      sql: 'SELECT key_escrow, key_escrow_updated_at FROM users WHERE id = ?',
      args: [user.id],
    });
    expect(row.rows[0][0]).toBe('iv.ciphertext');
    expect(row.rows[0][1]).not.toBeNull();
  });

  test('clearing with null wipes both the ciphertext and the timestamp', async () => {
    const user = await repo.getOrCreateUser(OLD_KEY);
    await repo.setKeyEscrow(user.id, 'iv.ciphertext').run();

    await repo.setKeyEscrow(user.id, null).run();

    const row = await client.execute({
      sql: 'SELECT key_escrow, key_escrow_updated_at FROM users WHERE id = ?',
      args: [user.id],
    });
    expect(row.rows[0][0]).toBeNull();
    expect(row.rows[0][1]).toBeNull();
  });
});

describe('recovery notices', () => {
  test('an unread notice is returned, and disappears once acked', async () => {
    const user = await repo.getOrCreateUser(OLD_KEY);
    await client.execute({
      sql: 'INSERT INTO recovery_notices (id, user_id, kind) VALUES (?, ?, ?)',
      args: ['notice-1', user.id, 'account_relinked'],
    });

    const before = await repo.listUnreadRecoveryNotices(OLD_KEY);
    expect(before).toHaveLength(1);
    expect(before[0].kind).toBe('account_relinked');

    await repo.markRecoveryNoticesRead(OLD_KEY, ['notice-1']).run();

    expect(await repo.listUnreadRecoveryNotices(OLD_KEY)).toHaveLength(0);
  });

  test('an unknown key has no notices, and acking with it changes nothing', async () => {
    const user = await repo.getOrCreateUser(OLD_KEY);
    await client.execute({
      sql: 'INSERT INTO recovery_notices (id, user_id, kind) VALUES (?, ?, ?)',
      args: ['notice-1', user.id, 'account_relinked'],
    });

    expect(await repo.listUnreadRecoveryNotices(NEW_KEY)).toEqual([]);
    await repo.markRecoveryNoticesRead(NEW_KEY, ['notice-1']).run();

    expect(await repo.listUnreadRecoveryNotices(OLD_KEY)).toHaveLength(1);
  });

  test('caps how many ids one ack can bind', async () => {
    const user = await repo.getOrCreateUser(OLD_KEY);
    const ids = Array.from({ length: 250 }, (_, i) => `notice-${i}`);
    for (const id of ids) {
      await client.execute({
        sql: 'INSERT INTO recovery_notices (id, user_id, kind) VALUES (?, ?, ?)',
        args: [id, user.id, 'account_relinked'],
      });
    }

    await repo.markRecoveryNoticesRead(OLD_KEY, ids).run();

    expect(await repo.listUnreadRecoveryNotices(OLD_KEY)).toHaveLength(50);
  });

  test("acking does not touch another user's notice", async () => {
    await repo.getOrCreateUser(OLD_KEY);
    const other = await repo.getOrCreateUser(NEW_KEY);
    await client.execute({
      sql: 'INSERT INTO recovery_notices (id, user_id, kind) VALUES (?, ?, ?)',
      args: ['notice-1', other.id, 'account_relinked'],
    });

    await repo.markRecoveryNoticesRead(OLD_KEY, ['notice-1']).run();

    expect(await repo.listUnreadRecoveryNotices(NEW_KEY)).toHaveLength(1);
  });
});
