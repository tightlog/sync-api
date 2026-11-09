import * as Sentry from '@sentry/cloudflare';
import {
  AttestError,
  verifyAssertion,
  verifyAttestation,
} from '@tightlog/app-attest';
import type { AppAttestEnv } from '@tightlog/app-attest';
import {
  ATTEST_ASSERTION_HEADER,
  ATTEST_KEY_ID_HEADER,
  PLAY_INTEGRITY_HEADER,
} from '@tightlog/protocol/attest';
import type { AttestRegistration } from '@tightlog/protocol/attest';
import { z } from 'zod';
import { commaList } from './comma-list';
import { json } from './json';
import { parseJsonBody } from './parse-body';
import {
  PLAY_INTEGRITY_TOKEN_MAX_LENGTH,
  playIntegritySettings,
  verifyPlayIntegrityToken,
} from './play-integrity';

export { PLAY_INTEGRITY_MAX_AGE_MS } from './play-integrity';

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

const ATTEST_REGISTER_BODY_LIMIT = 128 * 1024;

const MAX_KEY_ID_LENGTH = 512;

const MAX_ASSERTION_LENGTH = 8192;

export interface AttestEnv {
  APP_ATTEST_ENV?: string;
  APPLE_TEAM_ID?: string;
  APP_ATTEST_BUNDLE_IDS?: string;
  PLAY_PACKAGE_NAMES?: string;
  PLAY_CERT_SHA256?: string;
  PLAY_INTEGRITY_SERVICE_ACCOUNT?: string;
}

export interface AttestSettings {
  env: AppAttestEnv;
  teamId: string | null;
  bundleIds: string[];
  required: boolean;
  configured: boolean;
}

export function attestSettings(env: AttestEnv): AttestSettings {
  const appAttestEnv: AppAttestEnv =
    env.APP_ATTEST_ENV === 'development' ? 'development' : 'production';
  const teamId = env.APPLE_TEAM_ID ?? '';
  const bundleIds = commaList(env.APP_ATTEST_BUNDLE_IDS);
  return {
    env: appAttestEnv,
    teamId: teamId === '' ? null : teamId,
    bundleIds,
    required: appAttestEnv === 'production',
    configured: teamId !== '' && bundleIds.length > 0,
  };
}

export interface AttestKey {
  publicKeySpkiB64: string;
  bundleId: string;
  counter: number;
}

export type AdvanceResult =
  | { ok: true }
  | { ok: false; status: 401 | 429; error: string };

export interface AttestStore {
  issueChallenge(challenge: string, nowMs: number): Promise<void>;
  consumeChallenge(challenge: string, nowMs: number): Promise<boolean>;
  putKey(
    keyId: string,
    key: Omit<AttestKey, 'counter'>,
    nowMs: number,
  ): Promise<void>;
  getKey(keyId: string): Promise<AttestKey | null>;
  advanceCounter(keyId: string, counter: number): Promise<AdvanceResult>;
  claimPlayToken(tokenHash: string, nowMs: number): Promise<boolean>;
}

export type GateResult =
  | { ok: true }
  | { ok: false; status: 401 | 429 | 503; error: string };

export interface GateDeps {
  nowMs?: number;
  verifyPlayIntegrity?: typeof verifyPlayIntegrityToken;
}

const attestRegisterSchema = z.object({
  keyId: z.string().min(1).max(1024),
  attestation: z
    .string()
    .min(1)
    .max(64 * 1024),
  challenge: z.string().min(1).max(1024),
} satisfies Record<keyof AttestRegistration, z.ZodType>);

function randomChallenge(): string {
  return btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
  );
}

export async function issueChallenge(
  store: AttestStore,
  nowMs: number,
): Promise<string> {
  const challenge = randomChallenge();
  await store.issueChallenge(challenge, nowMs);
  return challenge;
}

export async function registerKey(
  env: AttestEnv,
  store: AttestStore,
  registration: AttestRegistration,
  nowMs: number,
): Promise<void> {
  if (!(await store.consumeChallenge(registration.challenge, nowMs))) {
    throw new AttestError('unknown or expired challenge');
  }

  const settings = attestSettings(env);
  if (!settings.teamId) {
    throw new AttestError('APPLE_TEAM_ID is not configured');
  }

  const result = await verifyAttestation(
    registration.keyId,
    registration.attestation,
    registration.challenge,
    settings.teamId,
    settings.bundleIds,
    settings.env,
  );
  await store.putKey(
    registration.keyId,
    { publicKeySpkiB64: result.publicKeySpkiB64, bundleId: result.bundleId },
    nowMs,
  );
}

const unavailable: GateResult = {
  ok: false,
  status: 503,
  error: 'attestation_unavailable',
};

async function gatePlayIntegrity(
  env: AttestEnv,
  store: AttestStore | null,
  token: string,
  requestHash: string,
  deps: GateDeps | undefined,
): Promise<GateResult> {
  if (token.length > PLAY_INTEGRITY_TOKEN_MAX_LENGTH) {
    return { ok: false, status: 401, error: 'attestation_malformed' };
  }

  const settings = playIntegritySettings(env);
  if (!settings || !store) {
    return unavailable;
  }

  const nowMs = deps?.nowMs ?? Date.now();
  const verify = deps?.verifyPlayIntegrity ?? verifyPlayIntegrityToken;
  const verdict = await verify({
    token,
    requestHash,
    packageNames: settings.packageNames,
    certificateDigests: settings.certificateDigests,
    serviceAccountJson: settings.serviceAccountJson,
    nowMs,
  });
  if (!verdict.ok) {
    return { ok: false, status: verdict.status, error: verdict.error };
  }

  if (!(await store.claimPlayToken(verdict.tokenHash, nowMs))) {
    return { ok: false, status: 401, error: 'play_integrity_replay' };
  }

  return { ok: true };
}

export async function attestGate(
  env: AttestEnv,
  store: AttestStore | null,
  headers: Headers,
  requestHash: string,
  deps?: GateDeps,
): Promise<GateResult> {
  const keyId = headers.get(ATTEST_KEY_ID_HEADER);
  const assertion = headers.get(ATTEST_ASSERTION_HEADER);
  const playToken = headers.get(PLAY_INTEGRITY_HEADER);
  const settings = attestSettings(env);

  if (!keyId && !assertion && !playToken && !settings.required) {
    return { ok: true };
  }

  if (playToken && !(keyId && assertion)) {
    return gatePlayIntegrity(env, store, playToken, requestHash, deps);
  }

  const teamId = settings.teamId;
  if (!settings.configured || !store || !teamId) {
    return unavailable;
  }

  if (!keyId || !assertion) {
    return { ok: false, status: 401, error: 'attestation_required' };
  }

  if (
    keyId.length > MAX_KEY_ID_LENGTH ||
    assertion.length > MAX_ASSERTION_LENGTH
  ) {
    return { ok: false, status: 401, error: 'attestation_malformed' };
  }

  const key = await store.getKey(keyId);
  if (!key) {
    return { ok: false, status: 401, error: 'attestation_unknown_key' };
  }

  let newCounter: number;
  try {
    ({ newCounter } = await verifyAssertion(
      assertion,
      requestHash,
      key.publicKeySpkiB64,
      key.counter,
      teamId,
      key.bundleId,
    ));
  } catch (e) {
    const error = e instanceof AttestError ? e.message : 'attestation_failed';
    return { ok: false, status: 401, error };
  }

  return store.advanceCounter(keyId, newCounter);
}

export function attestRejection(
  gate: Exclude<GateResult, { ok: true }>,
  route: string,
): Response {
  Sentry.captureMessage(`attest-gate rejected: ${gate.error}`, {
    level: gate.status === 503 ? 'error' : 'warning',
    tags: { route, reason: gate.error },
    fingerprint: ['attest-gate', gate.error],
  });
  const error =
    gate.status === 503
      ? 'attestation_unavailable'
      : gate.status === 429
        ? 'daily_limit'
        : 'attestation';
  return json({ error }, gate.status);
}

export async function handleAttestChallenge(
  env: AttestEnv,
  store: AttestStore | null,
  nowMs = Date.now(),
): Promise<Response> {
  if (!attestSettings(env).configured || !store) {
    return json({ error: 'attestation_unavailable' }, 503);
  }

  return json({ challenge: await issueChallenge(store, nowMs) });
}

export async function handleAttestRegister(
  request: Request,
  env: AttestEnv,
  store: AttestStore | null,
  nowMs = Date.now(),
): Promise<Response> {
  if (!attestSettings(env).configured || !store) {
    return json({ error: 'attestation_unavailable' }, 503);
  }

  const body = await parseJsonBody(
    request,
    ATTEST_REGISTER_BODY_LIMIT,
    attestRegisterSchema,
    'invalid_registration',
  );
  if (body instanceof Response) {
    return body;
  }

  try {
    await registerKey(env, store, body, nowMs);
    return json({ ok: true });
  } catch (e) {
    if (e instanceof AttestError) {
      Sentry.captureMessage(`attest-register rejected: ${e.message}`, {
        level: 'warning',
      });
      return json({ error: 'attestation' }, 401);
    }

    throw e;
  }
}
