import { getDb } from '../../db';
import { SyncRepo } from '../../repo';
import type { Env } from '../../types';
import { authenticate } from '../../utils/authenticate';

export async function handleEscrowKeyDelete(
  request: Request,
  env: Env,
): Promise<Response> {
  const keyHash = await authenticate(request, env, env.SYNC_RATE_LIMITER);
  if (keyHash instanceof Response) {
    return keyHash;
  }

  const repo = new SyncRepo(getDb(env));
  const user = await repo.getOrCreateUser(keyHash);
  await repo.setKeyEscrow(user.id, null).run();

  return Response.json({ ok: true });
}
