import type { Client } from '@libsql/client';
import { beforeEach, describe, expect, test } from 'vitest';
import type { GateResult } from '../attest';
import {
  adoptPurchaseChallenge,
  advanceCounter,
  attestGate,
  consumeChallenge,
  issueChallenge,
} from '../attest';
import type { SyncDb } from '../db';
import type { Env } from '../types';
import { migratedDb } from './sqlite-db';

const NOW = 1_800_000_000_000;
const TTL_MS = 5 * 60 * 1000;

let client: Client;
let db: SyncDb;

beforeEach(async () => {
  ({ client, db } = await migratedDb());
});

function env(overrides: Partial<Env> = {}): Env {
  return {
    TURSO_DATABASE_URL: 'libsql://test',
    SENTRY_ENVIRONMENT: 'test',
    APP_ATTEST_ENV: 'production',
    APPLE_TEAM_ID: 'TEAMID1234',
    APP_ATTEST_BUNDLE_IDS: 'com.example.app',
    ...overrides,
  };
}

function headers(keyId?: string, assertion?: string): Headers {
  const result = new Headers();

  if (keyId) {
    result.set('x-attest-key-id', keyId);
  }

  if (assertion) {
    result.set('x-attest-assertion', assertion);
  }

  return result;
}

async function addKey(keyId: string, counter: number): Promise<void> {
  await client.execute({
    sql: 'INSERT INTO attest_keys (key_id, public_key, bundle_id, counter, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [keyId, 'spki', 'com.example.app', counter, NOW],
  });
}

async function challengeCount(): Promise<number> {
  const res = await client.execute('SELECT COUNT(*) FROM attest_challenges');
  return Number(res.rows[0][0]);
}

describe('adoptPurchaseChallenge', () => {
  test('binds the method, the path, the customer id and the caller key', () => {
    expect(adoptPurchaseChallenge('$RCAnonymousID:abc', 'k'.repeat(64))).toBe(
      `POST\n/v1/sync/adopt-purchase\n$RCAnonymousID:abc\n${'k'.repeat(64)}`,
    );
  });
});

describe('attestGate', () => {
  const input = adoptPurchaseChallenge('$RCAnonymousID:abc', 'k'.repeat(64));

  test('lets an unattested request through in development', async () => {
    expect(
      await attestGate(
        env({ APP_ATTEST_ENV: 'development' }),
        db,
        headers(),
        input,
      ),
    ).toEqual<GateResult>({ ok: true });
  });

  test('refuses an unattested request in production', async () => {
    expect(await attestGate(env(), db, headers(), input)).toEqual<GateResult>({
      ok: false,
      status: 401,
      error: 'attestation_required',
    });
  });

  test('treats an unset environment as production', async () => {
    expect(
      await attestGate(
        env({ APP_ATTEST_ENV: undefined }),
        db,
        headers(),
        input,
      ),
    ).toEqual<GateResult>({
      ok: false,
      status: 401,
      error: 'attestation_required',
    });
  });

  test('fails closed in production when attestation is not configured', async () => {
    expect(
      await attestGate(env({ APPLE_TEAM_ID: undefined }), db, headers(), input),
    ).toEqual<GateResult>({
      ok: false,
      status: 503,
      error: 'attestation_unavailable',
    });
  });

  test('checks the headers when a development request sends them', async () => {
    expect(
      await attestGate(
        env({ APP_ATTEST_ENV: 'development' }),
        db,
        headers('unknown', 'assertion'),
        input,
      ),
    ).toEqual<GateResult>({
      ok: false,
      status: 401,
      error: 'attestation_unknown_key',
    });
  });

  test('refuses an oversized key id', async () => {
    expect(
      await attestGate(env(), db, headers('k'.repeat(513), 'a'), input),
    ).toEqual<GateResult>({
      ok: false,
      status: 401,
      error: 'attestation_malformed',
    });
  });

  test('refuses a key that was never registered', async () => {
    expect(
      await attestGate(env(), db, headers('unknown', 'assertion'), input),
    ).toEqual<GateResult>({
      ok: false,
      status: 401,
      error: 'attestation_unknown_key',
    });
  });

  test('refuses an assertion that does not verify', async () => {
    await addKey('k1', 0);

    expect(
      await attestGate(env(), db, headers('k1', 'bogus'), input),
    ).toEqual<GateResult>({
      ok: false,
      status: 401,
      error: 'assertion is not valid CBOR',
    });
  });
});

describe('challenges', () => {
  test('a challenge can be used once', async () => {
    const challenge = await issueChallenge(db, NOW);

    expect(await consumeChallenge(db, challenge, NOW + 1)).toBe(true);
    expect(await consumeChallenge(db, challenge, NOW + 2)).toBe(false);
  });

  test('an expired challenge is refused', async () => {
    const challenge = await issueChallenge(db, NOW);

    expect(await consumeChallenge(db, challenge, NOW + TTL_MS + 1)).toBe(false);
  });

  test('an unknown challenge is refused', async () => {
    expect(await consumeChallenge(db, 'never-issued', NOW)).toBe(false);
  });

  test('issuing a challenge prunes expired ones', async () => {
    await issueChallenge(db, NOW);
    await issueChallenge(db, NOW + TTL_MS + 1);

    expect(await challengeCount()).toBe(1);
  });
});

describe('advanceCounter', () => {
  test('accepts a higher counter', async () => {
    await addKey('k1', 3);
    expect(await advanceCounter(db, 'k1', 4)).toBe(true);
  });

  test('refuses a replayed counter', async () => {
    await addKey('k1', 3);

    expect(await advanceCounter(db, 'k1', 3)).toBe(false);
    expect(await advanceCounter(db, 'k1', 2)).toBe(false);
  });

  test('refuses an unknown key', async () => {
    expect(await advanceCounter(db, 'missing', 1)).toBe(false);
  });
});
