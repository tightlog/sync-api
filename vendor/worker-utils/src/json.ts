export function json<Body>(
  data: Body,
  status = 200,
  headers?: HeadersInit,
): Response {
  return Response.json(data, headers ? { status, headers } : { status });
}

// Social feed responses need CORS on every status.
export function jsonCors<Body>(data: Body, status = 200): Response {
  return json(data, status, { 'access-control-allow-origin': '*' });
}
