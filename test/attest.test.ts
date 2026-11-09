import type { Client } from '@libsql/client';
import { beforeEach, describe, expect, test } from 'vitest';
import { CHALLENGE_TTL_MS } from '@tightlog/worker-utils/attest';
import type { AdvanceResult, GateResult } from '@tightlog/worker-utils/attest';
import {
  tursoAttestGate,
  tursoAttestStore,
} from '@tightlog/worker-utils/attest-turso';
import { adoptPurchaseChallenge } from '@tightlog/protocol/sync';
import type { SyncDb } from '../src/db';
import type { Env } from '../src/types';
import { migratedDb } from './sqlite-db';

const NOW = 1_800_000_000_000;
const TTL_MS = CHALLENGE_TTL_MS;

let client: Client;
let db: SyncDb;

beforeEach(async () => {
  ({ client, db } = await migratedDb());
});

function env(): Env {
  return {
    TURSO_DATABASE_URL: 'libsql://test',
    SENTRY_ENVIRONMENT: 'test',
    APP_ATTEST_ENV: 'production',
    APPLE_TEAM_ID: 'TEAMID1234',
    APP_ATTEST_BUNDLE_IDS: 'com.example.app',
  };
}

function headers(keyId: string, assertion: string): Headers {
  return new Headers({
    'x-attest-key-id': keyId,
    'x-attest-assertion': assertion,
  });
}

async function challengeCount(): Promise<number> {
  const res = await client.execute('SELECT COUNT(*) FROM attest_challenges');
  return Number(res.rows[0]?.[0] ?? 0);
}

describe('attestGate against the sync database', () => {
  const input = adoptPurchaseChallenge('$RCAnonymousID:abc', 'k'.repeat(64));

  test('refuses a key that was never registered', async () => {
    expect(
      await tursoAttestGate(env(), db, headers('unknown', 'assertion'), input),
    ).toEqual<GateResult>({
      ok: false,
      status: 401,
      error: 'attestation_unknown_key',
    });
  });

  test('reads a registered key back for verification', async () => {
    await tursoAttestStore(db).putKey(
      'k1',
      { publicKeySpkiB64: 'spki', bundleId: 'com.example.app' },
      NOW,
    );

    expect(
      await tursoAttestGate(env(), db, headers('k1', 'bogus'), input),
    ).toEqual<GateResult>({
      ok: false,
      status: 401,
      error: 'assertion is not valid CBOR',
    });
  });
});

describe('Turso store', () => {
  test('a challenge can be used once', async () => {
    const store = tursoAttestStore(db);
    await store.issueChallenge('c1', NOW);

    expect(await store.consumeChallenge('c1', NOW + 1)).toBe(true);

    expect(await store.consumeChallenge('c1', NOW + 2)).toBe(false);
  });

  test('an expired or unknown challenge is refused', async () => {
    const store = tursoAttestStore(db);
    await store.issueChallenge('c1', NOW);

    expect(await store.consumeChallenge('c1', NOW + TTL_MS + 1)).toBe(false);

    expect(await store.consumeChallenge('never-issued', NOW)).toBe(false);
  });

  test('issuing a challenge prunes expired ones', async () => {
    const store = tursoAttestStore(db);
    await store.issueChallenge('c1', NOW);
    await store.issueChallenge('c2', NOW + TTL_MS + 1);

    expect(await challengeCount()).toBe(1);
  });

  test('re-registering a key keeps its counter', async () => {
    const store = tursoAttestStore(db);
    const key = { publicKeySpkiB64: 'spki', bundleId: 'com.example.app' };
    await store.putKey('k1', key, NOW);
    expect(await store.advanceCounter('k1', 4)).toEqual<AdvanceResult>({
      ok: true,
    });

    await store.putKey('k1', { ...key, publicKeySpkiB64: 'spki-2' }, NOW);
    expect(await store.getKey('k1')).toEqual({
      publicKeySpkiB64: 'spki-2',
      bundleId: 'com.example.app',
      counter: 4,
    });
  });

  test('advanceCounter refuses a replayed counter and an unknown key', async () => {
    const store = tursoAttestStore(db);
    await store.putKey(
      'k1',
      { publicKeySpkiB64: 'spki', bundleId: 'com.example.app' },
      NOW,
    );
    await store.advanceCounter('k1', 3);

    const replay: AdvanceResult = {
      ok: false,
      status: 401,
      error: 'attestation_replay',
    };
    expect(await store.advanceCounter('k1', 3)).toEqual(replay);

    expect(await store.advanceCounter('k1', 2)).toEqual(replay);

    expect(await store.advanceCounter('missing', 1)).toEqual(replay);

    expect(await store.getKey('missing')).toBeNull();
  });

  test('a play token is claimed once', async () => {
    const store = tursoAttestStore(db);
    expect(await store.claimPlayToken('t1', NOW)).toBe(true);

    expect(await store.claimPlayToken('t1', NOW + 1)).toBe(false);
  });
});
