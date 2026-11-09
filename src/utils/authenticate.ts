import { extractSyncKey } from '../auth';
import type { Env, RateLimit } from '../types';
import {
  clientIp,
  json,
  rateLimited,
  sha256HexOfText,
} from '@tightlog/worker-utils';
import type { SyncErrorBody } from '@tightlog/protocol/sync';

export interface SyncCaller {
  token: string;
  keyHash: string;
}

export async function authenticateCaller(
  request: Request,
  env: Env,
  limiter: RateLimit | undefined,
): Promise<SyncCaller | Response> {
  const throttled = await rateLimited(
    env.SYNC_IP_RATE_LIMITER,
    clientIp(request),
  );
  if (throttled) {
    return throttled;
  }

  const token = extractSyncKey(request);
  if (!token) {
    return json<SyncErrorBody>({ error: 'unauthorized' }, 401);
  }

  const keyHash = await sha256HexOfText(token);
  return (await rateLimited(limiter, keyHash)) ?? { token, keyHash };
}

export async function authenticate(
  request: Request,
  env: Env,
  limiter: RateLimit | undefined,
): Promise<string | Response> {
  const caller = await authenticateCaller(request, env, limiter);
  return caller instanceof Response ? caller : caller.keyHash;
}
