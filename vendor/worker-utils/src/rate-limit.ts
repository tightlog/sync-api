import { json } from './json';

export interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export function clientIp(request: Request): string {
  return request.headers.get('cf-connecting-ip') ?? 'unknown';
}

export async function rateLimited(
  limiter: RateLimit | undefined,
  key: string,
): Promise<Response | null> {
  if (!limiter) {
    return null;
  }

  const { success } = await limiter.limit({ key });
  return success ? null : json({ error: 'rate_limited' }, 429);
}
