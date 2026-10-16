import { isMediaBasename, mediaKey } from '../../media';
import type { Env } from '../../types';
import { mediaCaller } from './mediaCaller';

export async function handleMediaGet(
  request: Request,
  env: Env,
  basename: string,
): Promise<Response> {
  if (!isMediaBasename(basename)) {
    return Response.json({ error: 'invalid_basename' }, { status: 400 });
  }

  const caller = await mediaCaller(request, env);

  if (caller instanceof Response) {
    return caller;
  }

  const { bucket } = caller;
  const ifNoneMatch = request.headers
    .get('if-none-match')
    ?.replace(/^W\//, '')
    .replaceAll(/^"|"$/g, '');

  const object = await bucket.get(
    mediaKey(caller.userId, basename),
    ifNoneMatch ? { onlyIf: { etagDoesNotMatch: ifNoneMatch } } : undefined,
  );

  if (!object) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'private, max-age=31536000, immutable');

  if (!('body' in object) || !object.body) {
    return new Response(null, { status: 304, headers });
  }

  headers.set('content-length', String(object.size));
  return new Response(object.body, { headers });
}
