function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64'));
}

function importSecret(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    base64ToBytes(secret),
    'AES-GCM',
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptKeyEscrow(
  secret: string,
  syncKey: string,
): Promise<string> {
  const cryptoKey = await importSecret(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      new TextEncoder().encode(syncKey),
    ),
  );
  return `${bytesToBase64(iv)}.${bytesToBase64(ciphertext)}`;
}

export async function decryptKeyEscrow(
  secret: string,
  escrowed: string,
): Promise<string> {
  const [ivPart, ciphertextPart] = escrowed.split('.');
  if (!ivPart || !ciphertextPart) {
    throw new Error('malformed key escrow value');
  }

  const cryptoKey = await importSecret(secret);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(ivPart) },
    cryptoKey,
    base64ToBytes(ciphertextPart),
  );
  return new TextDecoder().decode(plaintext);
}
