import * as Sentry from '@sentry/cloudflare';
import { adoptPurchaseChallenge, attestGate } from '../../attest';
import { getDb } from '../../db';
import { SyncRepo } from '../../repo';
import { revenueCatService } from '../../services/revenuecat-service';
import type { Env } from '../../types';
import { authenticate } from '../../utils/authenticate';
import { rateLimited } from '../../utils/rateLimited';
import { adoptPurchaseSchema } from '../../validation/adopt';
import { parseBody } from '../../validation/parseBody';
import { metaBodyLimit } from '../../validation/register';
import { adoptIdentity } from './adoptIdentity';

export async function handleAdoptPurchase(
  request: Request,
  env: Env,
): Promise<Response> {
  const keyHash = await authenticate(request, env, env.ADOPT_RATE_LIMITER);
  if (keyHash instanceof Response) {
    return keyHash;
  }

  const body = await parseBody(request, metaBodyLimit, adoptPurchaseSchema);

  if (body instanceof Response) {
    return body;
  }

  const { appUserId, storeTransactionId } = body;

  if (!appUserId) {
    return Response.json({ error: 'app_user_id_required' }, { status: 400 });
  }

  if (!storeTransactionId) {
    return Response.json({ error: 'transaction_required' }, { status: 400 });
  }

  const db = getDb(env);
  const gate = await attestGate(
    env,
    db,
    request.headers,
    adoptPurchaseChallenge(appUserId, keyHash),
  );

  if (!gate.ok) {
    Sentry.captureMessage(`attest-gate rejected: ${gate.error}`, {
      level: 'warning',
      tags: { route: '/v1/sync/adopt-purchase', reason: gate.error },
      fingerprint: ['attest-gate', gate.error],
    });
    return Response.json(
      {
        error: gate.status === 503 ? 'attestation_unavailable' : 'attestation',
      },
      { status: gate.status },
    );
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
    return Response.json({ error: 'no_linked_identity' }, { status: 404 });
  }

  return adoptIdentity(repo, linked, keyHash);
}
