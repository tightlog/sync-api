import { describe, expect, test } from 'vitest';
import {
  isMediaBasename,
  MAX_STATUS_NAMES,
  mediaKey,
  parseBasename,
} from '../media';
import type { ParsedBasename } from '../media';
import { mediaStatusBodyLimit } from '../validation/media';

const HASH = 'a'.repeat(64);

describe('parseBasename', () => {
  test('splits a content-addressed name into its checksum and type', () => {
    expect(parseBasename(`${HASH}.jpg`)).toEqual<ParsedBasename>({
      sha256: HASH,
      contentType: 'image/jpeg',
    });
    expect(parseBasename(`${HASH}.mp4`)).toEqual<ParsedBasename>({
      sha256: HASH,
      contentType: 'video/mp4',
    });
  });

  test('rejects anything that is not a full SHA-256 stem', () => {
    expect(parseBasename('photo.jpg')).toBeNull();
    expect(parseBasename(`${'a'.repeat(63)}.jpg`)).toBeNull();
    expect(parseBasename(`${'a'.repeat(65)}.jpg`)).toBeNull();
    expect(parseBasename(`${HASH.toUpperCase()}.jpg`)).toBeNull();
    expect(parseBasename(HASH)).toBeNull();
  });

  test('rejects extensions we would not know how to serve', () => {
    expect(parseBasename(`${HASH}.exe`)).toBeNull();
    expect(parseBasename(`${HASH}.svg`)).toBeNull();
  });

  test('rejects names that could escape the user prefix', () => {
    expect(parseBasename(`../${HASH}.jpg`)).toBeNull();
    expect(parseBasename(`other-user/${HASH}.jpg`)).toBeNull();
    expect(isMediaBasename(`${HASH}/../../etc.jpg`)).toBe(false);
  });
});

describe('mediaKey', () => {
  test('scopes the object to the owning user', () => {
    expect(mediaKey('user-123', `${HASH}.jpg`)).toBe(`user-123/${HASH}.jpg`);
  });
});

describe('status batch sizing', () => {
  test('a full batch of the longest basenames fits its body cap', () => {
    const longest = `${'a'.repeat(64)}.jpeg`;
    const body = JSON.stringify({
      names: Array.from({ length: MAX_STATUS_NAMES }, () => longest),
    });
    const bytes = new TextEncoder().encode(body).byteLength;
    expect(bytes).toBeLessThanOrEqual(mediaStatusBodyLimit);
  });
});
