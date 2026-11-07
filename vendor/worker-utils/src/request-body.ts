import { json } from './json';
import { checkContentLength } from './request-size';

export type ErrorResponder = (
  body: { error: string },
  status: number,
) => Response;

export interface ReadJsonBodyOptions {
  respond?: ErrorResponder;
  requireContentLength?: boolean;
}

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; response: Response };

export async function readJsonBody(
  request: Request,
  maxBytes: number,
  { respond = json, requireContentLength = false }: ReadJsonBodyOptions = {},
): Promise<JsonBodyResult> {
  const fail = (error: string, status: number): JsonBodyResult => ({
    ok: false,
    response: respond({ error }, status),
  });

  const length = checkContentLength(request, maxBytes);
  if (!length.ok) {
    if (length.reason === 'too_large') {
      return fail('payload_too_large', 413);
    }

    if (requireContentLength) {
      return fail('content_length_required', 411);
    }
  }

  let bytes: ArrayBuffer;
  try {
    bytes = await request.arrayBuffer();
  } catch {
    return fail('bad_json', 400);
  }

  if (bytes.byteLength > maxBytes) {
    return fail('payload_too_large', 413);
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return fail('bad_json', 400);
  }
}
