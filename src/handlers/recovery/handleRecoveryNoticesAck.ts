import { json, parseJsonBody } from '@tightlog/worker-utils';
import { getDb } from '../../db';
import { SyncRepo } from '../../repo';
import type { Env } from '../../types';
import { authenticate } from '../../utils/authenticate';
import { recoveryNoticesAckSchema } from '../../validation/recovery';
import { metaBodyLimit } from '../../validation/register';

export async function handleRecoveryNoticesAck(
  request: Request,
  env: Env,
): Promise<Response> {
  const keyHash = await authenticate(request, env, env.SYNC_RATE_LIMITER);
  if (keyHash instanceof Response) {
    return keyHash;
  }

  const body = await parseJsonBody(
    request,
    metaBodyLimit,
    recoveryNoticesAckSchema,
  );
  if (body instanceof Response) {
    return body;
  }

  const ids = (body.ids ?? []).filter(id => id !== '');

  if (ids.length > 0) {
    await new SyncRepo(getDb(env)).markRecoveryNoticesRead(keyHash, ids).run();
  }

  return json({ ok: true });
}
