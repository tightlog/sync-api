import { requireKeyHash } from '../auth';
import type { Env, RateLimit } from '../types';
import { clientIp } from './clientIp';
import { rateLimited } from './rateLimited';

export async function authenticate(
  request: Request,
  env: Env,
  limiter: RateLimit | undefined,
): Promise<string | Response> {
  const [throttled, keyHash] = await Promise.all([
    rateLimited(env.SYNC_IP_RATE_LIMITER, clientIp(request)),
    requireKeyHash(request),
  ]);

  if (throttled) {
    return throttled;
  }

  if (keyHash instanceof Response) {
    return keyHash;
  }

  return (await rateLimited(limiter, keyHash)) ?? keyHash;
}
