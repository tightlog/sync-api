export function json<Body>(
  data: Body,
  status = 200,
  headers?: HeadersInit,
): Response {
  return Response.json(data, headers ? { status, headers } : { status });
}
