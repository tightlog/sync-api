import { attestGate, CHALLENGE_TTL_MS } from './attest';
import type {
  AttestEnv,
  AttestKey,
  AttestStore,
  GateDeps,
  GateResult,
} from './attest';
import type { Db } from './libsql';
import { sha256HexOfText } from './sha256';
import { PLAY_INTEGRITY_MAX_AGE_MS } from './play-integrity';

interface KeyRow {
  public_key: string;
  bundle_id: string;
  counter: number;
}

export function tursoAttestStore(db: Db): AttestStore {
  return {
    async issueChallenge(challenge, nowMs) {
      await db.batch([
        db
          .prepare(
            'INSERT INTO attest_challenges (challenge, created_at) VALUES (?, ?)',
          )
          .bind(challenge, nowMs),
        db
          .prepare('DELETE FROM attest_challenges WHERE created_at < ?')
          .bind(nowMs - CHALLENGE_TTL_MS),
      ]);
    },

    async consumeChallenge(challenge, nowMs) {
      const result = await db
        .prepare(
          'DELETE FROM attest_challenges WHERE challenge = ? AND created_at > ?',
        )
        .bind(challenge, nowMs - CHALLENGE_TTL_MS)
        .run();
      return result.meta.changes > 0;
    },

    async putKey(keyId, key, nowMs) {
      await db
        .prepare(
          `INSERT INTO attest_keys (key_id, public_key, bundle_id, counter, created_at)
           VALUES (?, ?, ?, 0, ?)
           ON CONFLICT (key_id) DO UPDATE SET
             public_key = excluded.public_key,
             bundle_id = excluded.bundle_id`,
        )
        .bind(keyId, key.publicKeySpkiB64, key.bundleId, nowMs)
        .run();
    },

    async getKey(keyId): Promise<AttestKey | null> {
      const row = await db
        .prepare(
          'SELECT public_key, bundle_id, counter FROM attest_keys WHERE key_id = ?',
        )
        .bind(keyId)
        .first<KeyRow>();
      return row
        ? {
            publicKeySpkiB64: row.public_key,
            bundleId: row.bundle_id,
            counter: row.counter,
          }
        : null;
    },

    async advanceCounter(keyId, counter) {
      const result = await db
        .prepare(
          'UPDATE attest_keys SET counter = ? WHERE key_id = ? AND counter < ?',
        )
        .bind(counter, keyId, counter)
        .run();
      return result.meta.changes > 0
        ? { ok: true }
        : { ok: false, status: 401, error: 'attestation_replay' };
    },

    async claimPlayToken(tokenHash, nowMs) {
      await db
        .prepare('DELETE FROM play_integrity_seen WHERE seen_at < ?')
        .bind(nowMs - PLAY_INTEGRITY_MAX_AGE_MS)
        .run();
      const inserted = await db
        .prepare(
          `INSERT INTO play_integrity_seen (token_hash, seen_at) VALUES (?, ?)
           ON CONFLICT (token_hash) DO NOTHING`,
        )
        .bind(tokenHash, nowMs)
        .run();
      return inserted.meta.changes === 1;
    },
  };
}

export async function tursoAttestGate(
  env: AttestEnv,
  db: Db | null,
  headers: Headers,
  challengeInput: string,
  deps?: GateDeps,
): Promise<GateResult> {
  return attestGate(
    env,
    db ? tursoAttestStore(db) : null,
    headers,
    await sha256HexOfText(challengeInput),
    deps,
  );
}
