const APP_USER_ID_PATTERN = /^[A-Za-z0-9$:_.@-]{8,128}$/;
const STORE_TRANSACTION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

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
