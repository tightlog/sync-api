import {
  MAX_MEDIA_BYTES,
  MAX_USER_MEDIA_BYTES,
  MAX_USER_MEDIA_OBJECTS,
  mediaKey,
  parseBasename,
} from '../../media';
import type { Env } from '../../types';
import { mediaCaller } from './mediaCaller';

export async function handleMediaPut(
  request: Request,
  env: Env,
  basename: string,
): Promise<Response> {
  const parsed = parseBasename(basename);

  if (!parsed) {
    return Response.json({ error: 'invalid_basename' }, { status: 400 });
  }

  const caller = await mediaCaller(request, env);

  if (caller instanceof Response) {
    return caller;
  }

  const declared = Number(request.headers.get('content-length'));
  if (!Number.isFinite(declared) || declared <= 0) {
    return Response.json({ error: 'content_length_required' }, { status: 411 });
  }

  if (declared > MAX_MEDIA_BYTES) {
    return Response.json({ error: 'payload_too_large' }, { status: 413 });
  }

  if (!request.body) {
    return Response.json({ error: 'body_required' }, { status: 400 });
  }

  const usage = await caller.repo.mediaUsage(caller.userId);
  const existing = await caller.repo.listExistingMediaBasenames(caller.userId, [
    basename,
  ]);
  const replacing = existing.has(basename);

  if (!replacing && usage.objects >= MAX_USER_MEDIA_OBJECTS) {
    return Response.json({ error: 'media_quota_objects' }, { status: 413 });
  }

  if (!replacing && usage.bytes + declared > MAX_USER_MEDIA_BYTES) {
    return Response.json({ error: 'media_quota_bytes' }, { status: 413 });
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
    return Response.json({ error: 'checksum_mismatch' }, { status: 422 });
  }
  if (!stored) {
    return Response.json({ error: 'upload_failed' }, { status: 500 });
  }

  await caller.repo.upsertMediaObject(caller.userId, {
    basename,
    bytes: stored.size,
    contentType: parsed.contentType,
  });
  return Response.json({ basename, bytes: stored.size });
}
