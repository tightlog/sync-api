import type { RateLimit } from '../types';

/**
 * Rate limit a given request
 */
export async function rateLimited(
  limiter: RateLimit | undefined,
  keyHash: string,
): Promise<Response | null> {
  if (!limiter) {
    return null;
  }

  const { success } = await limiter.limit({ key: keyHash });
  return success
    ? null
    : Response.json({ error: 'rate_limited' }, { status: 429 });
}
