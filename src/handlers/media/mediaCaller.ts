import { getDb } from '../../db';
import { SyncRepo } from '../../repo';
import type { Env } from '../../types';
import { authenticate } from '../../utils/authenticate';

export async function mediaCaller(
  request: Request,
  env: Env,
): Promise<{ userId: string; bucket: R2Bucket; repo: SyncRepo } | Response> {
  const bucket = env.MEDIA;
  if (!bucket) {
    return Response.json({ error: 'media_unavailable' }, { status: 503 });
  }
  const keyHash = await authenticate(request, env, env.MEDIA_RATE_LIMITER);
  if (keyHash instanceof Response) {
    return keyHash;
  }
  const repo = new SyncRepo(getDb(env));
  const userId = await repo.ensureUserId(keyHash);
  return { userId, bucket, repo };
}
