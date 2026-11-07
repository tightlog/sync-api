import type { z } from 'zod';
import { json, readJsonBody } from '@tightlog/worker-utils';

export async function parseBody<T>(
  request: Request,
  maxBytes: number,
  schema: z.ZodType<T>,
  error = 'bad_json',
  status = 400,
  opts?: { requireContentLength?: boolean },
): Promise<T | Response> {
  const body = await readJsonBody(request, maxBytes, opts);
  if (!body.ok) {
    return body.response;
  }

  const parsed = schema.safeParse(body.value);
  return parsed.success ? parsed.data : json({ error }, status);
}
