import { AttestError } from '../attest-error';
import type { Bytes } from '../types/bytes';

export function derSignatureToRaw(der: Bytes): Bytes {
  let offset = 0;
  if (der[offset++] !== 0x30) {
    throw new AttestError('signature is not a DER sequence');
  }

  offset++;

  const readInt = (): Uint8Array => {
    if (der[offset++] !== 0x02) {
      throw new AttestError('expected DER integer');
    }

    const len = der[offset++];
    let bytes = der.subarray(offset, offset + len);
    offset += len;
    while (bytes.length > 0 && bytes[0] === 0x00) {
      bytes = bytes.subarray(1);
    }

    if (bytes.byteLength > 32) {
      throw new AttestError('ECDSA integer too large');
    }

    const out = new Uint8Array(32);
    out.set(bytes, 32 - bytes.byteLength);
    return out;
  };

  const r = readInt();
  const s = readInt();
  const raw = new Uint8Array(64);
  raw.set(r, 0);
  raw.set(s, 32);
  return raw;
}
