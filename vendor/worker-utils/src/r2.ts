import { json } from './json';

export interface R2GetOptions {
  cacheControl: string;
  headers?: Record<string, string>;
}

interface StoredObject {
  httpEtag: string;
  size: number;
  body?: ReadableStream | null;
  writeHttpMetadata(headers: Headers): void;
}

export interface ObjectBucket {
  get(
    key: string,
    options?: { onlyIf: { etagDoesNotMatch: string } },
  ): Promise<StoredObject | null>;
}

export async function r2Get(
  bucket: ObjectBucket,
  key: string,
  request: Request,
  options: R2GetOptions,
): Promise<Response> {
  const ifNoneMatch = request.headers
    .get('if-none-match')
    ?.replace(/^W\//, '')
    .replaceAll(/^"|"$/g, '');
  const object = await bucket.get(
    key,
    ifNoneMatch ? { onlyIf: { etagDoesNotMatch: ifNoneMatch } } : undefined,
  );
  if (!object) {
    return json({ error: 'not_found' }, 404);
  }

  const headers = new Headers(options.headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', options.cacheControl);
  if (!object.body) {
    return new Response(null, { status: 304, headers });
  }

  object.writeHttpMetadata(headers);
  headers.set('content-length', String(object.size));
  return new Response(object.body, { headers });
}
