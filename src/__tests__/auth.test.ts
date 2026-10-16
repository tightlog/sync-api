import { describe, expect, test } from 'vitest';
import { isSyncKey } from '../auth';
import { sha256Hex } from '../utils/sha256Hex';

describe('isSyncKey', () => {
  test('accepts a well-formed key', () => {
    expect(isSyncKey(`logbook-key-${'a1'.repeat(32)}`)).toBe(true);
  });

  test('rejects malformed keys', () => {
    expect(isSyncKey('')).toBe(false);
    expect(isSyncKey('logbook-key-')).toBe(false);
    expect(isSyncKey(`logbook-key-${'a1'.repeat(31)}`)).toBe(false);
    expect(isSyncKey(`logbook-key-${'G1'.repeat(32)}`)).toBe(false);
    expect(isSyncKey('eyJhbGciOiJSUzI1NiJ9.x.y')).toBe(false);
  });
});

describe('sha256Hex', () => {
  test('matches the app-side identity id derivation', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
