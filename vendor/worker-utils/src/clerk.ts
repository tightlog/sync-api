import { verifyToken } from '@clerk/backend';

export interface ClerkEnv {
  CLERK_SECRET_KEY?: string;
  CLERK_JWT_KEY?: string;
}

export type ClerkVerdict =
  | { ok: true; userId: string }
  | { ok: false; reason: 'not_configured' | 'missing' | 'invalid' };

export function bearerToken(header: string | null): string | null {
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  const token = header.slice('bearer '.length).trim();
  return token || null;
}

export async function verifyClerkToken(
  token: string | null,
  env: ClerkEnv,
): Promise<ClerkVerdict> {
  if (!env.CLERK_SECRET_KEY) {
    return { ok: false, reason: 'not_configured' };
  }

  if (!token) {
    return { ok: false, reason: 'missing' };
  }

  try {
    const payload = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
      jwtKey: env.CLERK_JWT_KEY,
    });
    return payload.sub
      ? { ok: true, userId: payload.sub }
      : { ok: false, reason: 'invalid' };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}
