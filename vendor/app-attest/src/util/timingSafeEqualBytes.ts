import type { Bytes } from '../types/bytes';

export function timingSafeEqualBytes(a: Bytes, b: Bytes): boolean {
  if (a.byteLength !== b.byteLength) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.byteLength; i += 1) {
    diff |= a[i] ^ b[i];
  }

  return diff === 0;
}
