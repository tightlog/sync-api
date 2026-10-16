import * as Sentry from '@sentry/cloudflare';
import { handleAdopt } from './handlers/adopt/handleAdopt';
import { handleAdoptPurchase } from './handlers/adopt/handleAdoptPurchase';
import { handleAttestChallenge } from './handlers/attest/handleAttestChallenge';
import { handleAttestRegister } from './handlers/attest/handleAttestRegister';
import { handleEscrowKey } from './handlers/escrow/handleEscrowKey';
import { handleEscrowKeyDelete } from './handlers/escrow/handleEscrowKeyDelete';
import { handleIdentityProbe } from './handlers/identity/handleIdentityProbe';
import { handleMediaGet } from './handlers/media/handleMediaGet';
import { handleMediaPut } from './handlers/media/handleMediaPut';
import { handleMediaStatus } from './handlers/media/handleMediaStatus';
import { handlePull } from './handlers/pull/handlePull';
import { handlePush } from './handlers/push/handlePush';
import { handleRecoveryNoticesAck } from './handlers/recovery/handleRecoveryNoticesAck';
import { handleRecoveryNoticesPull } from './handlers/recovery/handleRecoveryNoticesPull';
import { handleRegister } from './handlers/register/handleRegister';
import type { Env } from './types';
import { clientIp } from './utils/clientIp';
import { rateLimited } from './utils/rateLimited';

const MEDIA_PATH = /^\/v1\/sync\/media\/([^/]+)$/;
const TABLE_PATH = /^\/v1\/sync\/([^/]+)$/;

type Route = (request: Request, env: Env) => Response | Promise<Response>;

const ROUTES = new Map<string, Route>([
  ['POST /v1/sync/register', handleRegister],
  ['POST /v1/sync/adopt', handleAdopt],
  ['POST /v1/sync/adopt-purchase', handleAdoptPurchase],
  ['GET /v1/sync/identity', handleIdentityProbe],
  ['POST /v1/sync/escrow-key', handleEscrowKey],
  ['DELETE /v1/sync/escrow-key', handleEscrowKeyDelete],
  ['GET /v1/sync/recovery-notices', handleRecoveryNoticesPull],
  ['POST /v1/sync/recovery-notices/ack', handleRecoveryNoticesAck],
  ['POST /v1/sync/media/status', handleMediaStatus],
]);

async function dispatch(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const { method } = request;

  if (pathname === '/health') {
    return Response.json({ ok: true });
  }

  if (
    (pathname === '/attest/challenge' || pathname === '/attest/register') &&
    method === 'POST'
  ) {
    const limited = await rateLimited(
      env.ATTEST_RATE_LIMITER,
      clientIp(request),
    );

    if (limited) {
      return limited;
    }

    return pathname === '/attest/challenge'
      ? handleAttestChallenge(env)
      : handleAttestRegister(request, env);
  }

  const route = ROUTES.get(`${method} ${pathname}`);

  if (route) {
    return route(request, env);
  }

  const mediaMatch = MEDIA_PATH.exec(pathname);

  if (mediaMatch) {
    const basename = decodeURIComponent(mediaMatch[1]);

    if (method === 'PUT') {
      return handleMediaPut(request, env, basename);
    }

    if (method === 'GET') {
      return handleMediaGet(request, env, basename);
    }
  }

  const tableMatch = TABLE_PATH.exec(pathname);

  if (tableMatch) {
    const table = decodeURIComponent(tableMatch[1]);

    if (method === 'GET') {
      return handlePull(request, env, table, url);
    }

    if (method === 'POST') {
      return handlePush(request, env, table, ctx);
    }
  }

  return Response.json({ error: 'not_found' }, { status: 404 });
}

export const handler = {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    try {
      return await dispatch(request, env, ctx);
    } catch (error) {
      console.error('unhandled sync error', error);
      Sentry.captureException(error);
      const message = error instanceof Error ? error.message : '';
      if (message === 'sync_boundary_overflow') {
        return Response.json(
          { error: 'sync_boundary_overflow' },
          { status: 503 },
        );
      }

      return Response.json({ error: 'internal_error' }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
