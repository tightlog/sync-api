import { attestRejection } from '@tightlog/worker-utils/attest';
import { adoptPurchaseChallenge } from '@tightlog/protocol/sync';
import { tursoAttestGate } from '@tightlog/worker-utils/attest-turso';
import { getDb } from '../../db';
import { SyncRepo } from '../../repo';
import { revenueCatService } from '../../services/revenuecat-service';
import type { Env } from '../../types';
import { authenticate } from '../../utils/authenticate';
import { json, rateLimited, parseJsonBody } from '@tightlog/worker-utils';
import { adoptPurchaseSchema } from '../../validation/adopt';
import { metaBodyLimit } from '../../validation/register';
import { adoptIdentity } from './adoptIdentity';
import type { SyncErrorBody } from '@tightlog/protocol/sync';

export async function handleAdoptPurchase(
  request: Request,
  env: Env,
): Promise<Response> {
  const keyHash = await authenticate(request, env, env.ADOPT_RATE_LIMITER);
  if (keyHash instanceof Response) {
    return keyHash;
  }

  const body = await parseJsonBody(request, metaBodyLimit, adoptPurchaseSchema);

  if (body instanceof Response) {
    return body;
  }

  const { appUserId, storeTransactionId } = body;

  if (!appUserId) {
    return json<SyncErrorBody>({ error: 'app_user_id_required' }, 400);
  }

  if (!storeTransactionId) {
    return json<SyncErrorBody>({ error: 'transaction_required' }, 400);
  }

  const db = getDb(env);
  const gate = await tursoAttestGate(
    env,
    db,
    request.headers,
    adoptPurchaseChallenge(appUserId, keyHash),
  );

  if (!gate.ok) {
    return attestRejection(gate, '/v1/sync/adopt-purchase');
  }

  const limited = await rateLimited(env.ADOPT_RATE_LIMITER, appUserId);

  if (limited) {
    return limited;
  }

  const verified = await revenueCatService.verifyPurchaseIdentity(
    env,
    appUserId,
    storeTransactionId,
    Date.now(),
  );

  if (verified instanceof Response) {
    return verified;
  }

  const repo = new SyncRepo(db);
  const linked = await repo.getUserByRevenueCatId(appUserId);
  if (!linked) {
    return json<SyncErrorBody>({ error: 'no_linked_identity' }, 404);
  }

  return adoptIdentity(repo, linked, keyHash);
}
