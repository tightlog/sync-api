import { attestConfigured, issueChallenge } from '../../attest';
import { getDb } from '../../db';
import type { Env } from '../../types';

export async function handleAttestChallenge(env: Env): Promise<Response> {
  if (!attestConfigured(env)) {
    return Response.json({ error: 'attestation_unavailable' }, { status: 503 });
  }

  return Response.json({
    challenge: await issueChallenge(getDb(env), Date.now()),
  });
}
