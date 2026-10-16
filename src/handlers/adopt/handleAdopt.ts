import * as Sentry from '@sentry/cloudflare';
import { adoptClerkChallenge, attestGate } from '../../attest';
import { getDb } from '../../db';
import { SyncRepo } from '../../repo';
import { clerkService } from '../../services/clerk-service';
import type { Env } from '../../types';
import { authenticate } from '../../utils/authenticate';
import { adoptSchema } from '../../validation/adopt';
import { parseBody } from '../../validation/parseBody';
import { metaBodyLimit } from '../../validation/register';
import { adoptIdentity } from './adoptIdentity';

export async function handleAdopt(
  request: Request,
  env: Env,
): Promise<Response> {
  const keyHash = await authenticate(request, env, env.ADOPT_RATE_LIMITER);
  if (keyHash instanceof Response) {
    return keyHash;
  }

  const body = await parseBody(request, metaBodyLimit, adoptSchema);
  if (body instanceof Response) {
    return body;
  }

  const { clerkToken } = body;
  if (!clerkToken) {
    return Response.json({ error: 'clerk_token_required' }, { status: 400 });
  }

  const identity = await clerkService.verifyIdentity(env, clerkToken);
  if (identity instanceof Response) {
    return identity;
  }

  const db = getDb(env);
  const gate = await attestGate(
    env,
    db,
    request.headers,
    adoptClerkChallenge(identity.clerkUserId, keyHash),
  );

  if (!gate.ok) {
    Sentry.captureMessage(`attest-gate rejected: ${gate.error}`, {
      level: 'warning',
      tags: { route: '/v1/sync/adopt', reason: gate.error },
      fingerprint: ['attest-gate', gate.error],
    });
    return Response.json(
      {
        error: gate.status === 503 ? 'attestation_unavailable' : 'attestation',
      },
      { status: gate.status },
    );
  }

  const repo = new SyncRepo(db);
  const linked = await repo.getUserByClerkId(identity.clerkUserId);
  if (!linked) {
    return Response.json({ error: 'no_linked_identity' }, { status: 404 });
  }

  return adoptIdentity(repo, linked, keyHash);
}
