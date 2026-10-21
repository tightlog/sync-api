import type { Bytes } from '../types/bytes';

export function bytesToBase64(bytes: Bytes): string {
  let binary = '';

  for (let i = 0; i < bytes.byteLength; i += 1) {
    const code = bytes[i];
    if (code === undefined) {
      break;
    }

    binary += String.fromCharCode(code);
  }

  return btoa(binary);
}
