export const ATTEST_KEY_ID_HEADER = 'x-attest-key-id';

export const ATTEST_ASSERTION_HEADER = 'x-attest-assertion';

export const PLAY_INTEGRITY_HEADER = 'x-play-integrity';

export const ATTEST_HEADERS = [
  ATTEST_KEY_ID_HEADER,
  ATTEST_ASSERTION_HEADER,
  PLAY_INTEGRITY_HEADER,
];

export const attestPaths = {
  challenge: '/attest/challenge',
  register: '/attest/register',
} as const;

export interface AttestChallengeResponse {
  challenge: string;
}

export interface AttestRegistration {
  keyId: string;
  attestation: string;
  challenge: string;
}

export type AttestErrorCode =
  | 'attestation'
  | 'attestation_unavailable'
  | 'daily_limit'
  | 'invalid_registration';
