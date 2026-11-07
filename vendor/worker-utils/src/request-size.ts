export type ContentLengthCheck =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'too_large' };

export function checkContentLength(
  request: Request,
  max: number,
): ContentLengthCheck {
  const header = request.headers.get('content-length');

  if (header === null) {
    return { ok: false, reason: 'missing' };
  }

  const len = Number(header);
  if (!Number.isFinite(len) || len < 0) {
    return { ok: false, reason: 'missing' };
  }

  if (len > max) {
    return { ok: false, reason: 'too_large' };
  }

  return { ok: true };
}

export function tooLargeByHeader(request: Request, max: number): boolean {
  const check = checkContentLength(request, max);
  return !check.ok && check.reason === 'too_large';
}
