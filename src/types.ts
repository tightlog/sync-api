export interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN?: string;
  SYNC_RATE_LIMITER?: RateLimit;
  SYNC_IP_RATE_LIMITER?: RateLimit;
  MEDIA_RATE_LIMITER?: RateLimit;
  ADOPT_RATE_LIMITER?: RateLimit;
  ATTEST_RATE_LIMITER?: RateLimit;
  MEDIA?: R2Bucket;
  CLERK_SECRET_KEY?: string;
  CLERK_JWT_KEY?: string;
  REVENUECAT_SECRET_API_KEY?: string;
  KEY_ESCROW_SECRET?: string;
  APPLE_TEAM_ID?: string;
  APP_ATTEST_BUNDLE_IDS?: string;
  APP_ATTEST_ENV?: string;
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT: string;
  SENTRY_TRACES_SAMPLE_RATE?: string;
  CF_VERSION_METADATA?: { id: string; tag: string; timestamp: string };
}

export interface SyncUser {
  id: string;
  keyHash: string;
  clerkUserId: string | null;
  revenueCatAppUserId: string | null;
  email: string | null;
  accountName: string | null;
  anglerName: string | null;
  createdAt: string;
  lastSyncedAt: string | null;
  keyEscrow: string | null;
}

export type SyncRow = { id: string; updatedAt: number } & Record<
  string,
  string | number | boolean | null
>;
