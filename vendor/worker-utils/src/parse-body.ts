import type { z } from 'zod';
import { json } from './json';
import { readJsonBody } from './request-body';
import type { ReadJsonBodyOptions } from './request-body';

export async function parseJsonBody<T>(
  request: Request,
  maxBytes: number,
  schema: z.ZodType<T>,
  error = 'bad_json',
  status = 400,
  options?: ReadJsonBodyOptions,
): Promise<T | Response> {
  const body = await readJsonBody(request, maxBytes, options);
  if (!body.ok) {
    return body.response;
  }

  const parsed = schema.safeParse(body.value);
  return parsed.success ? parsed.data : json({ error }, status);
}
