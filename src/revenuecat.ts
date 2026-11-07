const APP_USER_ID_PATTERN = /^[A-Za-z0-9$:_.@-]{8,128}$/;
const STORE_TRANSACTION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

interface SubscriberEntitlement {
  expires_date?: string | null;
}

interface SubscriberSubscription {
  expires_date?: string | null;
  store_transaction_id?: string | number | null;
}

export interface SubscriberResponse {
  subscriber?: {
    entitlements?: Record<string, SubscriberEntitlement>;
    subscriptions?: Record<string, SubscriberSubscription>;
  };
}

export function isAppUserId(value: string): boolean {
  return APP_USER_ID_PATTERN.test(value);
}

export function isStoreTransactionId(value: string): boolean {
  return STORE_TRANSACTION_ID_PATTERN.test(value);
}

/**
 * Own sync key, or `E2E_REVENUECAT_APP_USER_ID` when that variable is set.
 * Any other id lets the first writer own purchase restore.
 */
export function canClaimRevenueCatId(
  revenueCatAppUserId: string | null | undefined,
  keyHash: string,
  pinnedAppUserId?: string | null,
): revenueCatAppUserId is string {
  if (!revenueCatAppUserId || !isAppUserId(revenueCatAppUserId)) {
    return false;
  }

  if (revenueCatAppUserId === keyHash) {
    return true;
  }

  const pinned = pinnedAppUserId?.trim();
  return pinned != null && pinned.length > 0 && revenueCatAppUserId === pinned;
}

function isUnexpired(
  expires: string | null | undefined,
  nowMs: number,
): boolean {
  if (expires === null || expires === undefined) {
    return true;
  }

  const expiresMs = Date.parse(expires);
  return Number.isFinite(expiresMs) && expiresMs > nowMs;
}

export function hasActiveEntitlement(
  body: SubscriberResponse,
  nowMs: number,
): boolean {
  const entitlements = body.subscriber?.entitlements;
  if (!entitlements) {
    return false;
  }

  return Object.values(entitlements).some(entitlement =>
    isUnexpired(entitlement.expires_date, nowMs),
  );
}

export function ownsActiveSubscription(
  body: SubscriberResponse,
  storeTransactionId: string,
  nowMs: number,
): boolean {
  const subscriptions = body.subscriber?.subscriptions;
  if (!subscriptions) {
    return false;
  }

  return Object.values(subscriptions).some(subscription => {
    const txn = subscription.store_transaction_id;
    if (txn === null || txn === undefined) {
      return false;
    }

    if (String(txn) !== storeTransactionId) {
      return false;
    }

    return isUnexpired(subscription.expires_date, nowMs);
  });
}
