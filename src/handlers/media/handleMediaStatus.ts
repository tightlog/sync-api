import { isMediaBasename, MAX_STATUS_NAMES } from '../../media';
import type { Env } from '../../types';
import {
  mediaStatusBodyLimit,
  mediaStatusSchema,
} from '../../validation/media';
import { parseBody } from '../../validation/parseBody';
import { mediaCaller } from './mediaCaller';

export async function handleMediaStatus(
  request: Request,
  env: Env,
): Promise<Response> {
  const caller = await mediaCaller(request, env);

  if (caller instanceof Response) {
    return caller;
  }

  const body = await parseBody(
    request,
    mediaStatusBodyLimit,
    mediaStatusSchema,
  );

  if (body instanceof Response) {
    return body;
  }

  const { names } = body;
  if (names === null) {
    return Response.json({ error: 'names_required' }, { status: 400 });
  }

  if (names.length > MAX_STATUS_NAMES) {
    return Response.json({ error: 'too_many_names' }, { status: 413 });
  }

  const wanted = names.filter(isMediaBasename);
  const present = await caller.repo.listExistingMediaBasenames(
    caller.userId,
    wanted,
  );

  return Response.json({
    missing: wanted.filter(name => !present.has(name)),
  });
}
