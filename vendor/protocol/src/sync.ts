import type { AttestErrorCode } from './attest';
import type { RequestErrorCode } from './errors';

export const SYNC_KEY_PREFIX = 'logbook-key-';

const SYNC_KEY_HEX = /^[0-9a-f]{64}$/;

export function isSyncKey(token: string): boolean {
  return (
    token.startsWith(SYNC_KEY_PREFIX) &&
    SYNC_KEY_HEX.test(token.slice(SYNC_KEY_PREFIX.length))
  );
}

export const SCHEMA_VERSION_HEADER = 'x-tightlog-schema-version';

export const SYNC_SCHEMA_VERSION = 1;

export const SYNC_SINCE_PARAM = 'since';

export const syncPaths = {
  register: '/v1/sync/register',
  adopt: '/v1/sync/adopt',
  adoptPurchase: '/v1/sync/adopt-purchase',
  identity: '/v1/sync/identity',
  escrowKey: '/v1/sync/escrow-key',
  recoveryNotices: '/v1/sync/recovery-notices',
  recoveryNoticesAck: '/v1/sync/recovery-notices/ack',
  mediaStatus: '/v1/sync/media/status',
  table: (table: string) => `/v1/sync/${table}`,
  media: (basename: string) => `/v1/sync/media/${basename}`,
} as const;

export function adoptPurchaseChallenge(
  appUserId: string,
  keyHash: string,
): string {
  return `POST\n${syncPaths.adoptPurchase}\n${appUserId}\n${keyHash}`;
}

export function adoptClerkChallenge(
  clerkUserId: string,
  keyHash: string,
): string {
  return `POST\n${syncPaths.adopt}\n${clerkUserId}\n${keyHash}`;
}

export interface RegisterBody {
  deviceId: string;
  platform?: string;
  model?: string;
  osName?: string;
  osVersion?: string;
  appVersion?: string;
  anglerName?: string;
  clerkToken?: string;
  revenueCatAppUserId?: string;
}

export interface RegisterResponse {
  userId: string;
  hasKeyEscrow: boolean;
}

export interface AdoptPurchaseBody {
  appUserId: string;
  storeTransactionId: string;
}

export interface AdoptClerkBody {
  clerkToken: string;
}

export interface IdentitySummary {
  known: boolean;
  catches: number;
}

export interface PullResponse<Row> {
  items: Row[];
  nextSince?: number | null;
}

export interface PushBody<Row> {
  items: Row[];
}

export interface MediaStatusBody {
  names: string[];
}

export interface MediaStatusResponse {
  missing: string[];
}

export type RecoveryNoticeKind = 'account_relinked';

export interface RecoveryNotice {
  id: string;
  kind: RecoveryNoticeKind;
  createdAt: string;
}

export interface RecoveryNoticesResponse {
  items: RecoveryNotice[];
}

export interface RecoveryNoticesAckBody {
  ids: string[];
}

export type SyncErrorCode =
  | AttestErrorCode
  | RequestErrorCode
  | 'app_user_id_required'
  | 'body_required'
  | 'checksum_mismatch'
  | 'clerk_linked_elsewhere'
  | 'clerk_token_required'
  | 'existing_data'
  | 'internal_error'
  | 'invalid_app_user_id'
  | 'invalid_basename'
  | 'items_required'
  | 'media_quota_bytes'
  | 'media_quota_objects'
  | 'media_unavailable'
  | 'names_required'
  | 'no_active_entitlement'
  | 'no_linked_identity'
  | 'not_configured'
  | 'purchase_not_owned'
  | 'revenuecat_unreachable'
  | 'schema_outdated'
  | 'sync_boundary_overflow'
  | 'too_many_names'
  | 'too_many_rows'
  | 'transaction_required'
  | 'unauthorized'
  | 'unknown_customer'
  | 'unknown_table'
  | 'upload_failed';

export interface SyncErrorBody {
  error: SyncErrorCode;
}
