import { checkContentLength, json } from '@tightlog/worker-utils';
import {
  MAX_MEDIA_BYTES,
  MAX_USER_MEDIA_BYTES,
  MAX_USER_MEDIA_OBJECTS,
  mediaKey,
  parseBasename,
} from '../../media';
import type { Env } from '../../types';
import { mediaCaller } from './mediaCaller';
import type { SyncErrorBody } from '@tightlog/protocol/sync';

export async function handleMediaPut(
  request: Request,
  env: Env,
  basename: string,
): Promise<Response> {
  const parsed = parseBasename(basename);

  if (!parsed) {
    return json<SyncErrorBody>({ error: 'invalid_basename' }, 400);
  }

  const caller = await mediaCaller(request, env);

  if (caller instanceof Response) {
    return caller;
  }

  const length = checkContentLength(request, MAX_MEDIA_BYTES);
  if (!length.ok) {
    return length.reason === 'too_large'
      ? json<SyncErrorBody>({ error: 'payload_too_large' }, 413)
      : json<SyncErrorBody>({ error: 'content_length_required' }, 411);
  }

  if (!request.body || request.headers.get('content-length') === '0') {
    return json<SyncErrorBody>({ error: 'body_required' }, 400);
  }

  const declared = Number(request.headers.get('content-length'));
  const usage = await caller.repo.mediaUsage(caller.userId);
  const existing = await caller.repo.listExistingMediaBasenames(caller.userId, [
    basename,
  ]);
  const replacing = existing.has(basename);

  if (!replacing && usage.objects >= MAX_USER_MEDIA_OBJECTS) {
    return json<SyncErrorBody>({ error: 'media_quota_objects' }, 413);
  }

  if (!replacing && usage.bytes + declared > MAX_USER_MEDIA_BYTES) {
    return json<SyncErrorBody>({ error: 'media_quota_bytes' }, 413);
  }

  const key = mediaKey(caller.userId, basename);
  const { bucket } = caller;
  let stored: R2Object | null;

  try {
    stored = await bucket.put(key, request.body, {
      httpMetadata: { contentType: parsed.contentType },
      sha256: parsed.sha256,
    });
  } catch {
    return json<SyncErrorBody>({ error: 'checksum_mismatch' }, 422);
  }

  if (!stored) {
    return json<SyncErrorBody>({ error: 'upload_failed' }, 500);
  }

  await caller.repo.upsertMediaObject(caller.userId, {
    basename,
    bytes: stored.size,
    contentType: parsed.contentType,
  });
  return json({ basename, bytes: stored.size });
}
