import type { X509Certificate } from '@peculiar/x509';
import type { Bytes } from '../types/bytes';
import { AttestError } from '../attest-error';

const APPLE_NONCE_OID = '1.2.840.113635.100.8.2';

// The extension is a DER sequence that wraps the 32-byte nonce, so the nonce is
// the last 32 bytes.
export function nonceFromLeaf(leaf: X509Certificate): Bytes {
  const ext = leaf.extensions.find(e => e.type === APPLE_NONCE_OID);

  if (!ext) {
    throw new AttestError('leaf certificate missing Apple nonce extension');
  }

  const raw = new Uint8Array(ext.value);

  if (raw.byteLength < 32) {
    throw new AttestError('nonce extension too short');
  }

  return raw.subarray(raw.byteLength - 32);
}
