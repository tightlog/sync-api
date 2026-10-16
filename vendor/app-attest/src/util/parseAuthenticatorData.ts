import { AttestError } from '../attest-error';
import type { Bytes } from '../types/bytes';

export interface AuthenticatorData {
  rpIdHash: Bytes;
  counter: number;
  aaguid: Bytes;
  credentialId: Bytes | null;
}

// WebAuthn layout: rpIdHash (32), flags (1), counter (4, big-endian). Attested
// credential data follows: aaguid (16), credential id length (2), credential id.
export function parseAuthenticatorData(
  authData: Bytes,
  withCredential: boolean,
): AuthenticatorData {
  if (authData.byteLength < 37) {
    throw new AttestError('authenticator data too short');
  }

  const view = new DataView(
    authData.buffer,
    authData.byteOffset,
    authData.byteLength,
  );

  const rpIdHash = authData.subarray(0, 32);
  const counter = view.getUint32(33, false);

  let aaguid: Bytes = new Uint8Array(0);
  let credentialId: Bytes | null = null;

  if (withCredential) {
    if (authData.byteLength < 55) {
      throw new AttestError('attested credential data too short');
    }

    aaguid = authData.subarray(37, 53);
    const credIdLen = view.getUint16(53, false);
    const end = 55 + credIdLen;

    if (authData.byteLength < end) {
      throw new AttestError('credential id runs past authenticator data');
    }

    credentialId = authData.subarray(55, end);
  }

  return {
    rpIdHash,
    aaguid,
    counter,
    credentialId,
  };
}
