import { json, parseJsonBody } from '@tightlog/worker-utils';
import { attestRejection } from '@tightlog/worker-utils/attest';
import { adoptClerkChallenge } from '@tightlog/protocol/sync';
import { tursoAttestGate } from '@tightlog/worker-utils/attest-turso';
import { getDb } from '../../db';
import { SyncRepo } from '../../repo';
import { clerkService } from '../../services/clerk-service';
import type { Env } from '../../types';
import { authenticate } from '../../utils/authenticate';
import { adoptSchema } from '../../validation/adopt';
import { metaBodyLimit } from '../../validation/register';
import { adoptIdentity } from './adoptIdentity';
import type { SyncErrorBody } from '@tightlog/protocol/sync';

export async function handleAdopt(
  request: Request,
  env: Env,
): Promise<Response> {
  const keyHash = await authenticate(request, env, env.ADOPT_RATE_LIMITER);
  if (keyHash instanceof Response) {
    return keyHash;
  }

  const body = await parseJsonBody(request, metaBodyLimit, adoptSchema);
  if (body instanceof Response) {
    return body;
  }

  const { clerkToken } = body;
  if (!clerkToken) {
    return json<SyncErrorBody>({ error: 'clerk_token_required' }, 400);
  }

  const identity = await clerkService.verifyIdentity(env, clerkToken);
  if (identity instanceof Response) {
    return identity;
  }

  const db = getDb(env);
  const gate = await tursoAttestGate(
    env,
    db,
    request.headers,
    adoptClerkChallenge(identity.clerkUserId, keyHash),
  );

  if (!gate.ok) {
    return attestRejection(gate, '/v1/sync/adopt');
  }

  const repo = new SyncRepo(db);
  const linked = await repo.getUserByClerkId(identity.clerkUserId);
  if (!linked) {
    return json<SyncErrorBody>({ error: 'no_linked_identity' }, 404);
  }

  return adoptIdentity(repo, linked, keyHash);
}
