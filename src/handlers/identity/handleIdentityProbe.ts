import { getDb } from '../../db';
import { SyncRepo } from '../../repo';
import type { Env } from '../../types';
import { authenticate } from '../../utils/authenticate';

export async function handleIdentityProbe(
  request: Request,
  env: Env,
): Promise<Response> {
  const keyHash = await authenticate(request, env, env.SYNC_RATE_LIMITER);
  if (keyHash instanceof Response) {
    return keyHash;
  }

  const summary = await new SyncRepo(getDb(env)).getIdentitySummary(keyHash);
  return Response.json(summary);
}
