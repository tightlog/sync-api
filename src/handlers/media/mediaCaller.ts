import { json } from '@tightlog/worker-utils';
import { getDb } from '../../db';
import { SyncRepo } from '../../repo';
import type { Env } from '../../types';
import { authenticate } from '../../utils/authenticate';
import type { SyncErrorBody } from '@tightlog/protocol/sync';

export async function mediaCaller(
  request: Request,
  env: Env,
): Promise<{ userId: string; bucket: R2Bucket; repo: SyncRepo } | Response> {
  const bucket = env.MEDIA;
  if (!bucket) {
    return json<SyncErrorBody>({ error: 'media_unavailable' }, 503);
  }

  const keyHash = await authenticate(request, env, env.MEDIA_RATE_LIMITER);
  if (keyHash instanceof Response) {
    return keyHash;
  }

  const repo = new SyncRepo(getDb(env));
  const userId = await repo.ensureUserId(keyHash);
  return { userId, bucket, repo };
}
