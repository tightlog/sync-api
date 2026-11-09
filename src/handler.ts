import { getDb } from './db';
import {
  handleAttestChallenge,
  handleAttestRegister,
} from '@tightlog/worker-utils/attest';
import { tursoAttestStore } from '@tightlog/worker-utils/attest-turso';
import * as Sentry from '@sentry/cloudflare';
import { handleAdopt } from './handlers/adopt/handleAdopt';
import { handleAdoptPurchase } from './handlers/adopt/handleAdoptPurchase';
import { handleEscrowKey } from './handlers/escrow/handleEscrowKey';
import { handleEscrowKeyDelete } from './handlers/escrow/handleEscrowKeyDelete';
import {
  json,
  clientIp,
  handleHealth,
  rateLimited,
} from '@tightlog/worker-utils';
import { handleIdentityProbe } from './handlers/identity/handleIdentityProbe';
import { handleMediaGet } from './handlers/media/handleMediaGet';
import { handleMediaPut } from './handlers/media/handleMediaPut';
import { handleMediaStatus } from './handlers/media/handleMediaStatus';
import { handlePull } from './handlers/pull/handlePull';
import { handlePush } from './handlers/push/handlePush';
import { handleRecoveryNoticesAck } from './handlers/recovery/handleRecoveryNoticesAck';
import { handleRecoveryNoticesPull } from './handlers/recovery/handleRecoveryNoticesPull';
import { handleRegister } from './handlers/register/handleRegister';
import { SyncBoundaryOverflowError } from './repo';
import type { Env } from './types';
import { attestPaths } from '@tightlog/protocol/attest';
import { syncPaths } from '@tightlog/protocol/sync';
import type { SyncErrorBody } from '@tightlog/protocol/sync';

const MEDIA_PATH = new RegExp(`^${syncPaths.media('([^/]+)')}$`);
const TABLE_PATH = new RegExp(`^${syncPaths.table('([^/]+)')}$`);

type Route = (request: Request, env: Env) => Response | Promise<Response>;

const ROUTES = new Map<string, Route>([
  [`POST ${syncPaths.register}`, handleRegister],
  [`POST ${syncPaths.adopt}`, handleAdopt],
  [`POST ${syncPaths.adoptPurchase}`, handleAdoptPurchase],
  [`GET ${syncPaths.identity}`, handleIdentityProbe],
  [`POST ${syncPaths.escrowKey}`, handleEscrowKey],
  [`DELETE ${syncPaths.escrowKey}`, handleEscrowKeyDelete],
  [`GET ${syncPaths.recoveryNotices}`, handleRecoveryNoticesPull],
  [`POST ${syncPaths.recoveryNoticesAck}`, handleRecoveryNoticesAck],
  [`POST ${syncPaths.mediaStatus}`, handleMediaStatus],
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
    return handleHealth(env);
  }

  if (
    (pathname === attestPaths.challenge || pathname === attestPaths.register) &&
    method === 'POST'
  ) {
    const limited = await rateLimited(
      env.ATTEST_RATE_LIMITER,
      clientIp(request),
    );

    if (limited) {
      return limited;
    }

    const store = tursoAttestStore(getDb(env));
    return pathname === attestPaths.challenge
      ? handleAttestChallenge(env, store)
      : handleAttestRegister(request, env, store);
  }

  const route = ROUTES.get(`${method} ${pathname}`);

  if (route) {
    return route(request, env);
  }

  const mediaMatch = MEDIA_PATH.exec(pathname);

  const mediaBasename = mediaMatch?.[1];
  if (mediaBasename) {
    const basename = decodeURIComponent(mediaBasename);

    if (method === 'PUT') {
      return handleMediaPut(request, env, basename);
    }

    if (method === 'GET') {
      return handleMediaGet(request, env, basename);
    }
  }

  const tableMatch = TABLE_PATH.exec(pathname);
  const tableName = tableMatch?.[1];

  if (tableName) {
    const table = decodeURIComponent(tableName);

    if (method === 'GET') {
      return handlePull(request, env, table, url);
    }

    if (method === 'POST') {
      return handlePush(request, env, table, ctx);
    }
  }

  return json<SyncErrorBody>({ error: 'not_found' }, 404);
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
      if (error instanceof SyncBoundaryOverflowError) {
        return json({ error: error.message }, 503);
      }

      return json<SyncErrorBody>({ error: 'internal_error' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
