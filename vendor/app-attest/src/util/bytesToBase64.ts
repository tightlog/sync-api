import type { Bytes } from '../types/bytes';

export function bytesToBase64(bytes: Bytes): string {
  let binary = '';

  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
