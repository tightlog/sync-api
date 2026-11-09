import { json } from '@tightlog/worker-utils';
import { getDb } from '../../db';
import { encryptKeyEscrow } from '../../key-escrow';
import { SyncRepo } from '../../repo';
import type { Env } from '../../types';
import { authenticateCaller } from '../../utils/authenticate';
import type { SyncErrorBody } from '@tightlog/protocol/sync';

export async function handleEscrowKey(
  request: Request,
  env: Env,
): Promise<Response> {
  const caller = await authenticateCaller(request, env, env.SYNC_RATE_LIMITER);
  if (caller instanceof Response) {
    return caller;
  }

  const secret = env.KEY_ESCROW_SECRET;
  if (!secret) {
    return json<SyncErrorBody>({ error: 'not_configured' }, 501);
  }

  const repo = new SyncRepo(getDb(env));
  const user = await repo.getOrCreateUser(caller.keyHash);
  const ciphertext = await encryptKeyEscrow(secret, caller.token);
  await repo.setKeyEscrow(user.id, ciphertext).run();

  return json({ ok: true });
}
