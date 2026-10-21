import type { Bytes } from '../types/bytes';

export function timingSafeEqualBytes(a: Bytes, b: Bytes): boolean {
  if (a.byteLength !== b.byteLength) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.byteLength; i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    diff |= left ^ right;
  }

  return diff === 0;
}
