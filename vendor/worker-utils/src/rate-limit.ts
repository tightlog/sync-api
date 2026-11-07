import { json } from './json';
import type { ErrorResponder } from './request-body';

export interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export function clientIp(request: Request): string {
  return request.headers.get('cf-connecting-ip') ?? 'unknown';
}

export async function rateLimited(
  limiter: RateLimit | undefined,
  key: string,
  respond: ErrorResponder = json,
): Promise<Response | null> {
  if (!limiter) {
    return null;
  }

  const { success } = await limiter.limit({ key });
  return success ? null : respond({ error: 'rate_limited' }, 429);
}
