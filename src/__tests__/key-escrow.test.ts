import { describe, expect, test } from 'vitest';
import { encryptKeyEscrow, decryptKeyEscrow } from '../key-escrow';

const SECRET = Buffer.from('a'.repeat(32)).toString('base64');
const OTHER_SECRET = Buffer.from('b'.repeat(32)).toString('base64');
const SYNC_KEY = `logbook-key-${'c'.repeat(64)}`;

describe('key escrow encryption', () => {
  test('round-trips the sync key under the same secret', async () => {
    const escrowed = await encryptKeyEscrow(SECRET, SYNC_KEY);
    expect(await decryptKeyEscrow(SECRET, escrowed)).toBe(SYNC_KEY);
  });

  test('two encryptions of the same key produce different ciphertext', async () => {
    const first = await encryptKeyEscrow(SECRET, SYNC_KEY);
    const second = await encryptKeyEscrow(SECRET, SYNC_KEY);
    expect(first).not.toBe(second);
  });

  test('fails to decrypt under the wrong secret', async () => {
    const escrowed = await encryptKeyEscrow(SECRET, SYNC_KEY);
    await expect(decryptKeyEscrow(OTHER_SECRET, escrowed)).rejects.toThrow();
  });

  test('rejects a malformed stored value', async () => {
    await expect(
      decryptKeyEscrow(SECRET, 'not-a-valid-value'),
    ).rejects.toThrow();
  });
});
