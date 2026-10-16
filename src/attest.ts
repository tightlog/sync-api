import {
  AttestError,
  verifyAssertion,
  verifyAttestation,
} from '@tightlog/app-attest';
import type { AppAttestEnv } from '@tightlog/app-attest';
import type { SyncDb } from './db';
import type { Env } from './types';
import { sha256Hex } from './utils/sha256Hex';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function attestEnv(env: Env): AppAttestEnv {
  return env.APP_ATTEST_ENV === 'development' ? 'development' : 'production';
}

/**
 * production,testflight or internal app variants
 */
function allowedBundleIds(env: Env): string[] {
  return (env.APP_ATTEST_BUNDLE_IDS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

export function attestConfigured(env: Env): boolean {
  return Boolean(env.APPLE_TEAM_ID && allowedBundleIds(env).length > 0);
}

function attestRequired(env: Env): boolean {
  return attestEnv(env) === 'production';
}

export function adoptPurchaseChallenge(
  appUserId: string,
  keyHash: string,
): string {
  return `POST\n/v1/sync/adopt-purchase\n${appUserId}\n${keyHash}`;
}

export function adoptClerkChallenge(
  clerkUserId: string,
  keyHash: string,
): string {
  return `POST\n/v1/sync/adopt\n${clerkUserId}\n${keyHash}`;
}

export async function issueChallenge(db: SyncDb, now: number): Promise<string> {
  const challenge = Buffer.from(
    crypto.getRandomValues(new Uint8Array(32)),
  ).toString('base64');

  await db.batch([
    db
      .prepare(
        'INSERT INTO attest_challenges (challenge, created_at) VALUES (?, ?)',
      )
      .bind(challenge, now),
    db
      .prepare('DELETE FROM attest_challenges WHERE created_at < ?')
      .bind(now - CHALLENGE_TTL_MS),
  ]);
  return challenge;
}

export async function consumeChallenge(
  db: SyncDb,
  challenge: string,
  now: number,
): Promise<boolean> {
  const row = await db
    .prepare(
      'DELETE FROM attest_challenges WHERE challenge = ? AND created_at > ? RETURNING challenge',
    )
    .bind(challenge, now - CHALLENGE_TTL_MS)
    .first();

  return row !== null;
}

export async function registerKey(
  db: SyncDb,
  env: Env,
  keyId: string,
  attestation: string,
  challenge: string,
  now: number,
): Promise<void> {
  if (!(await consumeChallenge(db, challenge, now))) {
    throw new AttestError('unknown or expired challenge');
  }

  const teamId = env.APPLE_TEAM_ID;
  if (!teamId) {
    throw new AttestError('APPLE_TEAM_ID is not configured');
  }

  const result = await verifyAttestation(
    keyId,
    attestation,
    challenge,
    teamId,
    allowedBundleIds(env),
    attestEnv(env),
  );
  await db
    .prepare(
      `INSERT INTO attest_keys (key_id, public_key, bundle_id, counter, created_at)
       VALUES (?, ?, ?, 0, ?)
       ON CONFLICT (key_id) DO UPDATE SET
         public_key = excluded.public_key,
         bundle_id = excluded.bundle_id`,
    )
    .bind(keyId, result.publicKeySpkiB64, result.bundleId, now)
    .run();
}

export async function advanceCounter(
  db: SyncDb,
  keyId: string,
  counter: number,
): Promise<boolean> {
  const row = await db
    .prepare(
      'UPDATE attest_keys SET counter = ? WHERE key_id = ? AND counter < ? RETURNING counter',
    )
    .bind(counter, keyId, counter)
    .first();

  return row !== null;
}

export type GateResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

export async function attestGate(
  env: Env,
  db: SyncDb,
  headers: Headers,
  challengeInput: string,
): Promise<GateResult> {
  const keyId = headers.get('x-attest-key-id');
  const assertion = headers.get('x-attest-assertion');

  if ((!keyId || !assertion) && !attestRequired(env)) {
    return { ok: true };
  }

  const teamId = env.APPLE_TEAM_ID;
  if (!teamId || !attestConfigured(env)) {
    return { ok: false, status: 503, error: 'attestation_unavailable' };
  }

  if (!keyId || !assertion) {
    return { ok: false, status: 401, error: 'attestation_required' };
  }

  if (keyId.length > 512 || assertion.length > 8192) {
    return { ok: false, status: 401, error: 'attestation_malformed' };
  }

  const row = await db
    .prepare(
      'SELECT public_key, bundle_id, counter FROM attest_keys WHERE key_id = ?',
    )
    .bind(keyId)
    .first<{ public_key: string; bundle_id: string; counter: number }>();

  if (!row) {
    return { ok: false, status: 401, error: 'attestation_unknown_key' };
  }

  let newCounter: number;
  try {
    ({ newCounter } = await verifyAssertion(
      assertion,
      await sha256Hex(challengeInput),
      row.public_key,
      row.counter,
      teamId,
      row.bundle_id,
    ));
  } catch (e) {
    const error = e instanceof AttestError ? e.message : 'attestation_failed';
    return { ok: false, status: 401, error };
  }

  if (!(await advanceCounter(db, keyId, newCounter))) {
    return { ok: false, status: 401, error: 'attestation_replay' };
  }
  return { ok: true };
}
