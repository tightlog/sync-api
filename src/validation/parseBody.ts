import type { z } from 'zod';
import { checkContentLength } from '../utils/tooLargeByHeader';

export async function parseBody<T>(
  request: Request,
  maxBytes: number,
  schema: z.ZodType<T>,
  error = 'bad_json',
  status = 400,
  opts?: { requireContentLength?: boolean },
): Promise<T | Response> {
  const length = checkContentLength(request, maxBytes);

  if (!length.ok) {
    if (length.reason === 'too_large') {
      return Response.json({ error: 'payload_too_large' }, { status: 413 });
    }
    if (opts?.requireContentLength) {
      return Response.json(
        { error: 'content_length_required' },
        { status: 411 },
      );
    }
  }

  let bytes: ArrayBuffer;
  try {
    bytes = await request.arrayBuffer();
  } catch {
    return Response.json({ error: 'bad_json' }, { status: 400 });
  }

  if (bytes.byteLength > maxBytes) {
    return Response.json({ error: 'payload_too_large' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return Response.json({ error: 'bad_json' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  return parsed.success
    ? parsed.data
    : Response.json({ error }, { status: status });
}
