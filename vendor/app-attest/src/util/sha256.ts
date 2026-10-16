import type { Bytes } from '../types/bytes';

export async function sha256(...parts: Bytes[]): Promise<Bytes> {
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const joined = new Uint8Array(total);
  let offset = 0;

  for (const part of parts) {
    joined.set(part, offset);
    offset += part.byteLength;
  }

  const digest = await crypto.subtle.digest('SHA-256', joined);
  return new Uint8Array(digest);
}
