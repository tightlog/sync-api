import { extractSyncKey } from '../../auth';
import { getDb } from '../../db';
import { encryptKeyEscrow } from '../../key-escrow';
import { SyncRepo } from '../../repo';
import type { Env } from '../../types';
import { authenticate } from '../../utils/authenticate';

export async function handleEscrowKey(
  request: Request,
  env: Env,
): Promise<Response> {
  const keyHash = await authenticate(request, env, env.SYNC_RATE_LIMITER);
  if (keyHash instanceof Response) {
    return keyHash;
  }
  const secret = env.KEY_ESCROW_SECRET;
  if (!secret) {
    return Response.json({ error: 'not_configured' }, { status: 501 });
  }
  const token = extractSyncKey(request);
  if (!token) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const repo = new SyncRepo(getDb(env));
  const user = await repo.getOrCreateUser(keyHash);
  const ciphertext = await encryptKeyEscrow(secret, token);
  await repo.setKeyEscrow(user.id, ciphertext).run();

  return Response.json({ ok: true });
}
