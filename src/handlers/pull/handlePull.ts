import { json } from '@tightlog/worker-utils';
import { SYNC_SINCE_PARAM } from '@tightlog/protocol/sync';
import { getDb } from '../../db';
import { SyncRepo } from '../../repo';
import { schemaVersionError } from '../../schema';
import { isSyncTable, syncRowFromDb } from '../../tables';
import type { Env } from '../../types';
import { authenticate } from '../../utils/authenticate';
import type { SyncErrorBody } from '@tightlog/protocol/sync';

export async function handlePull(
  request: Request,
  env: Env,
  table: string,
  url: URL,
): Promise<Response> {
  if (!isSyncTable(table)) {
    return json<SyncErrorBody>({ error: 'unknown_table' }, 404);
  }

  const outdated = schemaVersionError(request);
  if (outdated) {
    return outdated;
  }

  const keyHash = await authenticate(request, env, env.SYNC_RATE_LIMITER);
  if (keyHash instanceof Response) {
    return keyHash;
  }

  const since = Number(url.searchParams.get(SYNC_SINCE_PARAM) ?? 0);
  const sinceMs = Number.isFinite(since) && since > 0 ? Math.trunc(since) : 0;

  const { rows, nextSince } = await new SyncRepo(getDb(env)).listSince(
    table,
    keyHash,
    sinceMs,
  );
  return json({
    items: rows.map(row => syncRowFromDb(table, row)),
    nextSince,
  });
}
