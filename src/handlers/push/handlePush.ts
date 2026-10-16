import { getDb } from '../../db';
import { SyncRepo } from '../../repo';
import { schemaVersionError } from '../../schema';
import {
  isSyncTable,
  MAX_PUSH_ROWS,
  sanitizeRow,
  syncRowFromDb,
} from '../../tables';
import type { Env } from '../../types';
import { authenticate } from '../../utils/authenticate';
import { parseBody } from '../../validation/parseBody';
import { pushBodyLimit, pushSchema } from '../../validation/push';
import { collectOrphanedMedia } from './collectOrphanedMedia';

export async function handlePush(
  request: Request,
  env: Env,
  table: string,
  ctx: ExecutionContext,
): Promise<Response> {
  if (!isSyncTable(table)) {
    return Response.json({ error: 'unknown_table' }, { status: 404 });
  }
  const outdated = schemaVersionError(request);
  if (outdated) {
    return outdated;
  }
  const keyHash = await authenticate(request, env, env.SYNC_RATE_LIMITER);
  if (keyHash instanceof Response) {
    return keyHash;
  }

  const body = await parseBody(
    request,
    pushBodyLimit,
    pushSchema,
    'bad_json',
    400,
    { requireContentLength: true },
  );
  if (body instanceof Response) {
    return body;
  }

  const { items } = body;

  if (items === null) {
    return Response.json({ error: 'items_required' }, { status: 400 });
  }

  if (items.length > MAX_PUSH_ROWS) {
    return Response.json({ error: 'too_many_rows' }, { status: 413 });
  }

  const nowMs = Date.now();
  const rows = items
    .map(item => sanitizeRow(table, item, nowMs))
    .filter(row => row !== null);

  if (rows.length === 0) {
    return Response.json({ items: [] });
  }

  const repo = new SyncRepo(getDb(env));
  const merged = await repo.upsertRows(table, keyHash, rows);

  if (table === 'catch_media' && env.MEDIA) {
    ctx.waitUntil(collectOrphanedMedia(repo, env.MEDIA, keyHash, rows));
  }

  return Response.json({
    items: merged.map(row => syncRowFromDb(table, row)),
  });
}
