import type {
  MediaStatusResponse,
  SyncErrorBody,
} from '@tightlog/protocol/sync';
import { json, parseJsonBody } from '@tightlog/worker-utils';
import { isMediaBasename, MAX_STATUS_NAMES } from '../../media';
import type { Env } from '../../types';
import {
  mediaStatusBodyLimit,
  mediaStatusSchema,
} from '../../validation/media';
import { mediaCaller } from './mediaCaller';

export async function handleMediaStatus(
  request: Request,
  env: Env,
): Promise<Response> {
  const caller = await mediaCaller(request, env);

  if (caller instanceof Response) {
    return caller;
  }

  const body = await parseJsonBody(
    request,
    mediaStatusBodyLimit,
    mediaStatusSchema,
  );

  if (body instanceof Response) {
    return body;
  }

  const { names } = body;
  if (names === null) {
    return json<SyncErrorBody>({ error: 'names_required' }, 400);
  }

  if (names.length > MAX_STATUS_NAMES) {
    return json<SyncErrorBody>({ error: 'too_many_names' }, 413);
  }

  const wanted = names.filter(isMediaBasename);
  const present = await caller.repo.listExistingMediaBasenames(
    caller.userId,
    wanted,
  );

  const response: MediaStatusResponse = {
    missing: wanted.filter(name => !present.has(name)),
  };
  return json(response);
}
