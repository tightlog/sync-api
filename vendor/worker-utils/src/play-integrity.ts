import { z } from 'zod';

export const PLAY_INTEGRITY_HEADER = 'x-play-integrity';

export const PLAY_INTEGRITY_TOKEN_MAX_LENGTH = 16_384;

export const PLAY_INTEGRITY_MAX_AGE_MS = 2 * 60 * 1000;

const TOKEN_FUTURE_SKEW_MS = 60 * 1000;

const PLAY_INTEGRITY_SCOPE = 'https://www.googleapis.com/auth/playintegrity';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

const DEVICE_VERDICTS = new Set([
  'MEETS_DEVICE_INTEGRITY',
  'MEETS_STRONG_INTEGRITY',
]);

export class PlayIntegrityError extends Error {
  readonly kind: 'rejected' | 'unavailable';

  constructor(kind: 'rejected' | 'unavailable', message: string) {
    super(message);
    this.name = 'PlayIntegrityError';
    this.kind = kind;
  }
}

export type PlayIntegrityVerdict = {
  requestPackageName: string;
  requestHash: string;
  timestampMillis: number;
  appRecognitionVerdict: string;
  packageName: string;
  certificateSha256Digest: string[];
  deviceRecognitionVerdict: string[];
};

export type PlayIntegritySettings = {
  packageNames: string[];
  certificateDigests: string[];
  serviceAccountJson: string;
};

type PlayIntegrityEnv = {
  PLAY_PACKAGE_NAMES?: string;
  PLAY_CERT_SHA256?: string;
  PLAY_INTEGRITY_SERVICE_ACCOUNT?: string;
};

export type PlayIntegrityGate =
  | { ok: true; tokenHash: string }
  | { ok: false; status: 401 | 503; error: string };

type CachedToken = {
  email: string;
  token: string;
  expMs: number;
};

let cachedToken: CachedToken | null = null;

function commaList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    return null;
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

export function normalizeCertDigest(value: string): string | null {
  const compact = value.trim().replaceAll(':', '');
  if (/^[0-9a-f]+$/i.test(compact) && compact.length === 64) {
    const bytes = hexToBytes(compact);
    return bytes === null ? null : bytesToBase64Url(bytes);
  }

  const normalized = value
    .trim()
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
  if (!/^[A-Za-z0-9_-]{43}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

export function playIntegritySettings(
  env: PlayIntegrityEnv,
): PlayIntegritySettings | null {
  const packageNames = commaList(env.PLAY_PACKAGE_NAMES);
  const certificateDigests = commaList(env.PLAY_CERT_SHA256)
    .map(normalizeCertDigest)
    .filter(digest => digest !== null);
  const serviceAccountJson = env.PLAY_INTEGRITY_SERVICE_ACCOUNT?.trim() ?? '';
  if (
    packageNames.length === 0 ||
    certificateDigests.length === 0 ||
    serviceAccountJson.length === 0
  ) {
    return null;
  }

  return { packageNames, certificateDigests, serviceAccountJson };
}

export function judgePlayIntegrity(
  verdict: PlayIntegrityVerdict,
  expected: {
    packageNames: string[];
    certificateDigests: string[];
    requestHash: string;
    nowMs: number;
  },
): { ok: true } | { ok: false; error: string } {
  if (
    expected.requestHash.length === 0 ||
    verdict.requestHash !== expected.requestHash
  ) {
    return { ok: false, error: 'play_integrity_hash' };
  }

  if (
    !expected.packageNames.includes(verdict.requestPackageName) ||
    verdict.packageName !== verdict.requestPackageName
  ) {
    return { ok: false, error: 'play_integrity_package' };
  }

  if (verdict.appRecognitionVerdict !== 'PLAY_RECOGNIZED') {
    return { ok: false, error: 'play_integrity_app' };
  }

  const allowed = new Set(expected.certificateDigests);
  const matched = verdict.certificateSha256Digest.some(digest => {
    const normalized = normalizeCertDigest(digest);
    return normalized !== null && allowed.has(normalized);
  });
  if (!matched) {
    return { ok: false, error: 'play_integrity_certificate' };
  }

  if (
    !verdict.deviceRecognitionVerdict.some(item => DEVICE_VERDICTS.has(item))
  ) {
    return { ok: false, error: 'play_integrity_device' };
  }

  if (!Number.isFinite(verdict.timestampMillis)) {
    return { ok: false, error: 'play_integrity_time' };
  }

  const age = expected.nowMs - verdict.timestampMillis;
  if (age > PLAY_INTEGRITY_MAX_AGE_MS || age < -TOKEN_FUTURE_SKEW_MS) {
    return { ok: false, error: 'play_integrity_time' };
  }

  return { ok: true };
}

const serviceAccountSchema = z.object({
  client_email: z.string().min(1),
  private_key: z.string().min(1),
});

const accessTokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive().optional().catch(undefined),
});

const playIntegrityPayloadSchema = z
  .object({
    tokenPayloadExternal: z.object({
      requestDetails: z.object({
        requestPackageName: z.string(),
        requestHash: z.string(),
        timestampMillis: z.union([z.string(), z.number()]),
      }),
      appIntegrity: z.object({
        appRecognitionVerdict: z.string(),
        packageName: z.string(),
        certificateSha256Digest: z.array(z.string()).default([]),
      }),
      deviceIntegrity: z
        .object({
          deviceRecognitionVerdict: z.array(z.string()).default([]),
        })
        .optional(),
    }),
  })
  .transform((body): PlayIntegrityVerdict => {
    const { requestDetails, appIntegrity, deviceIntegrity } =
      body.tokenPayloadExternal;

    return {
      requestPackageName: requestDetails.requestPackageName,
      requestHash: requestDetails.requestHash,
      timestampMillis: Number(requestDetails.timestampMillis),
      appRecognitionVerdict: appIntegrity.appRecognitionVerdict,
      packageName: appIntegrity.packageName,
      certificateSha256Digest: appIntegrity.certificateSha256Digest,
      deviceRecognitionVerdict: deviceIntegrity?.deviceRecognitionVerdict ?? [],
    };
  });

export function parsePlayIntegrityPayload(
  body: z.input<typeof playIntegrityPayloadSchema>,
): PlayIntegrityVerdict {
  const parsed = playIntegrityPayloadSchema.safeParse(body);
  if (!parsed.success) {
    throw new PlayIntegrityError('rejected', 'play_integrity_malformed');
  }

  return parsed.data;
}

function pemToBytes(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function signServiceAccountJwt(
  account: z.infer<typeof serviceAccountSchema>,
  nowSec: number,
): Promise<{ jwt: string; email: string }> {
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      'pkcs8',
      pemToBytes(account.private_key),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );
  } catch {
    throw new PlayIntegrityError('unavailable', 'play_integrity_unavailable');
  }

  const header = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
  );
  const claim = bytesToBase64Url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: account.client_email,
        scope: PLAY_INTEGRITY_SCOPE,
        aud: TOKEN_URL,
        iat: nowSec,
        exp: nowSec + 3600,
      }),
    ),
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${header}.${claim}`),
  );
  return {
    email: account.client_email,
    jwt: `${header}.${claim}.${bytesToBase64Url(new Uint8Array(signature))}`,
  };
}

async function accessToken(
  serviceAccountJson: string,
  fetchImpl: typeof fetch,
  nowMs: number,
): Promise<string> {
  let account: z.infer<typeof serviceAccountSchema>;
  try {
    account = serviceAccountSchema.parse(JSON.parse(serviceAccountJson));
  } catch {
    throw new PlayIntegrityError('unavailable', 'play_integrity_unavailable');
  }

  const email = account.client_email;
  if (
    cachedToken &&
    cachedToken.email === email &&
    cachedToken.expMs > nowMs + 60_000
  ) {
    return cachedToken.token;
  }

  const { jwt } = await signServiceAccountJwt(
    account,
    Math.floor(nowMs / 1000),
  );
  let response: Response;
  try {
    response = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new PlayIntegrityError('unavailable', 'play_integrity_unavailable');
  }

  if (!response.ok) {
    throw new PlayIntegrityError('unavailable', 'play_integrity_unavailable');
  }

  const tokenBody = accessTokenSchema.safeParse(await response.json());
  if (!tokenBody.success) {
    throw new PlayIntegrityError('unavailable', 'play_integrity_unavailable');
  }

  const expiresIn = tokenBody.data.expires_in ?? 3600;
  cachedToken = {
    email,
    token: tokenBody.data.access_token,
    expMs: nowMs + expiresIn * 1000,
  };
  return tokenBody.data.access_token;
}

async function decodeForPackage(
  token: string,
  packageName: string,
  serviceAccountJson: string,
  fetchImpl: typeof fetch,
  nowMs: number,
  attempt: number,
): Promise<PlayIntegrityVerdict> {
  const bearer = await accessToken(serviceAccountJson, fetchImpl, nowMs);
  let response: Response;
  try {
    response = await fetchImpl(
      `https://playintegrity.googleapis.com/v1/${encodeURIComponent(packageName)}:decodeIntegrityToken`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${bearer}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ integrityToken: token }),
        signal: AbortSignal.timeout(10_000),
      },
    );
  } catch {
    throw new PlayIntegrityError('unavailable', 'play_integrity_unavailable');
  }

  if (response.status === 401 && attempt === 0) {
    cachedToken = null;
    return decodeForPackage(
      token,
      packageName,
      serviceAccountJson,
      fetchImpl,
      nowMs,
      1,
    );
  }

  if (response.status === 400) {
    throw new PlayIntegrityError('rejected', 'play_integrity_rejected');
  }

  if (!response.ok) {
    throw new PlayIntegrityError('unavailable', 'play_integrity_unavailable');
  }

  return parsePlayIntegrityPayload(await response.json());
}

export async function decodePlayIntegrityToken(options: {
  token: string;
  packageNames: string[];
  serviceAccountJson: string;
  fetchImpl?: typeof fetch;
  nowMs?: number;
}): Promise<PlayIntegrityVerdict> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const nowMs = options.nowMs ?? Date.now();
  let rejected: PlayIntegrityError | null = null;
  for (const packageName of options.packageNames) {
    try {
      return await decodeForPackage(
        options.token,
        packageName,
        options.serviceAccountJson,
        fetchImpl,
        nowMs,
        0,
      );
    } catch (error) {
      if (error instanceof PlayIntegrityError && error.kind === 'rejected') {
        rejected = error;
        continue;
      }

      throw error;
    }
  }

  throw (
    rejected ?? new PlayIntegrityError('rejected', 'play_integrity_rejected')
  );
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), byte =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export async function verifyPlayIntegrityToken(options: {
  token: string;
  requestHash: string;
  packageNames: string[];
  certificateDigests: string[];
  serviceAccountJson: string;
  nowMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<PlayIntegrityGate> {
  const nowMs = options.nowMs ?? Date.now();
  try {
    const verdict = await decodePlayIntegrityToken({
      token: options.token,
      packageNames: options.packageNames,
      serviceAccountJson: options.serviceAccountJson,
      fetchImpl: options.fetchImpl,
      nowMs,
    });
    const judged = judgePlayIntegrity(verdict, {
      packageNames: options.packageNames,
      certificateDigests: options.certificateDigests,
      requestHash: options.requestHash,
      nowMs,
    });
    if (!judged.ok) {
      return { ok: false, status: 401, error: judged.error };
    }

    return { ok: true, tokenHash: await sha256Hex(options.token) };
  } catch (error) {
    if (error instanceof PlayIntegrityError) {
      return {
        ok: false,
        status: error.kind === 'unavailable' ? 503 : 401,
        error: error.message,
      };
    }

    return { ok: false, status: 503, error: 'play_integrity_unavailable' };
  }
}
