import * as x509 from '@peculiar/x509';
import type { Bytes } from '../types/bytes';
import { AttestError } from '../attest-error';
import { APPLE_APP_ATTEST_ROOT_CA_PEM } from '../constants/apple-root-ca';
import { timingSafeEqualBytes } from './timingSafeEqualBytes';

let appleRoot: x509.X509Certificate | null = null;

export async function verifyCertChain(
  x5c: Bytes[],
): Promise<x509.X509Certificate> {
  if (x5c.length < 2) {
    throw new AttestError(
      'attestation x5c entries must hold leaf + intermediate',
    );
  }
  if (!x5c.every(der => der instanceof Uint8Array)) {
    throw new AttestError('attestation x5c entries must be byte strings');
  }

  const root = (appleRoot ??= new x509.X509Certificate(
    APPLE_APP_ATTEST_ROOT_CA_PEM,
  ));
  let chain: x509.X509Certificate[];

  try {
    chain = x5c.map(der => new x509.X509Certificate(der));
  } catch {
    throw new AttestError('attestation x5c is not a valid certificate');
  }

  const builder = new x509.X509ChainBuilder({ certificates: [...chain, root] });
  const built = await builder.build(chain[0]);
  const terminal = built.at(-1);
  if (!terminal) {
    throw new AttestError('attestation chain is empty');
  }

  if (
    !timingSafeEqualBytes(
      new Uint8Array(terminal.rawData),
      new Uint8Array(root.rawData),
    )
  ) {
    throw new AttestError('chain does not terminate at Apple App Attest root');
  }

  const now = new Date();

  for (const [i, cert] of built.entries()) {
    if (now < cert.notBefore || now > cert.notAfter) {
      throw new AttestError(
        'a certificate in the chain is expired or not yet valid',
      );
    }

    const issuer = built[i + 1];
    if (issuer && !(await cert.verify({ publicKey: issuer.publicKey }))) {
      throw new AttestError(
        'certificate signature does not verify against its issuer',
      );
    }
  }
  return chain[0];
}
