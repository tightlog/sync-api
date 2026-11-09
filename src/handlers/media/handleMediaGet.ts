import { json, r2Get } from '@tightlog/worker-utils';
import { isMediaBasename, mediaKey } from '../../media';
import type { Env } from '../../types';
import { mediaCaller } from './mediaCaller';
import type { SyncErrorBody } from '@tightlog/protocol/sync';

export async function handleMediaGet(
  request: Request,
  env: Env,
  basename: string,
): Promise<Response> {
  if (!isMediaBasename(basename)) {
    return json<SyncErrorBody>({ error: 'invalid_basename' }, 400);
  }

  const caller = await mediaCaller(request, env);

  if (caller instanceof Response) {
    return caller;
  }

  return r2Get(caller.bucket, mediaKey(caller.userId, basename), request, {
    cacheControl: 'private, max-age=31536000, immutable',
  });
}
