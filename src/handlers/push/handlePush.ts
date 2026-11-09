import { json, parseJsonBody } from '@tightlog/worker-utils';
import { getDb } from '../../db';
import { SyncRepo } from '../../repo';
import { schemaVersionError } from '../../schema';
import {
  isSyncTable,
  MAX_PUSH_ROWS,
  sanitizeRow,
  syncRowFromDb,
} from '../../tables';
import type { SanitizedRow, SyncTable } from '../../tables';
import type { Env } from '../../types';
import { authenticate } from '../../utils/authenticate';
import { pushBodyLimit, pushSchema } from '../../validation/push';
import { collectOrphanedMedia } from './collectOrphanedMedia';
import type { SyncErrorBody } from '@tightlog/protocol/sync';

type AfterPush = (
  repo: SyncRepo,
  env: Env,
  keyHash: string,
  rows: SanitizedRow[],
) => Promise<void>;

const AFTER_PUSH = {
  catch_media: (repo, env, keyHash, rows) =>
    env.MEDIA
      ? collectOrphanedMedia(repo, env.MEDIA, keyHash, rows)
      : Promise.resolve(),
} satisfies Partial<Record<SyncTable, AfterPush>>;

function afterPushFor(table: SyncTable): AfterPush | undefined {
  // SAFETY: the `in` check above proves table is a key of AFTER_PUSH.
  return table in AFTER_PUSH
    ? AFTER_PUSH[table as keyof typeof AFTER_PUSH]
    : undefined;
}

export async function handlePush(
  request: Request,
  env: Env,
  table: string,
  ctx: ExecutionContext,
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

  const body = await parseJsonBody(
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
    return json<SyncErrorBody>({ error: 'items_required' }, 400);
  }

  if (items.length > MAX_PUSH_ROWS) {
    return json<SyncErrorBody>({ error: 'too_many_rows' }, 413);
  }

  const nowMs = Date.now();
  const rows = items
    .map(item => sanitizeRow(table, item, nowMs))
    .filter(row => row !== null);

  if (rows.length === 0) {
    return json({ items: [] });
  }

  const repo = new SyncRepo(getDb(env));
  const merged = await repo.upsertRows(table, keyHash, rows);

  const afterPush = afterPushFor(table);
  if (afterPush) {
    ctx.waitUntil(afterPush(repo, env, keyHash, rows));
  }

  return json({
    items: merged.map(row => syncRowFromDb(table, row)),
  });
}
