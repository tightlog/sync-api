import { AttestError } from '@tightlog/app-attest';
import { attestConfigured, registerKey } from '../../attest';
import { getDb } from '../../db';
import type { Env } from '../../types';
import { attestBodyLimit, attestRegisterSchema } from '../../validation/attest';
import { parseBody } from '../../validation/parseBody';

export async function handleAttestRegister(
  request: Request,
  env: Env,
): Promise<Response> {
  if (!attestConfigured(env)) {
    return Response.json({ error: 'attestation_unavailable' }, { status: 503 });
  }

  const body = await parseBody(request, attestBodyLimit, attestRegisterSchema);

  if (body instanceof Response) {
    return body;
  }

  try {
    await registerKey(
      getDb(env),
      env,
      body.keyId,
      body.attestation,
      body.challenge,
      Date.now(),
    );
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof AttestError) {
      return Response.json({ error: 'attestation' }, { status: 401 });
    }
    throw e;
  }
}
