import { z } from 'zod';
import { commaList } from './comma-list';

const SUBSCRIBERS_URL = 'https://api.revenuecat.com/v1/subscribers/';

export interface RevenueCatEnv {
  REVENUECAT_SECRET_KEY?: string;
  REVENUECAT_ENTITLEMENT_IDS?: string;
}

export interface RevenueCatSettings {
  secretKey: string;
  entitlementIds: string[];
}

export function configuredEntitlementIds(env: RevenueCatEnv): string[] {
  return commaList(env.REVENUECAT_ENTITLEMENT_IDS);
}

export function revenueCatSettings(
  env: RevenueCatEnv,
): RevenueCatSettings | null {
  const secretKey = env.REVENUECAT_SECRET_KEY ?? '';
  const entitlementIds = configuredEntitlementIds(env);
  return secretKey !== '' && entitlementIds.length > 0
    ? { secretKey, entitlementIds }
    : null;
}

const expiry = z.string().nullish();

const subscriberSchema = z.object({
  subscriber: z.object({
    entitlements: z
      .record(z.string(), z.object({ expires_date: expiry }).nullable())
      .catch({}),
    subscriptions: z
      .record(
        z.string(),
        z.object({
          expires_date: expiry,
          store_transaction_id: z.union([z.string(), z.number()]).nullish(),
        }),
      )
      .catch({}),
  }),
});

export type Subscriber = z.infer<typeof subscriberSchema>['subscriber'];

export type SubscriberLookup =
  | { status: 'ok'; subscriber: Subscriber }
  | { status: 'not_found' }
  | { status: 'unavailable' };

export async function fetchSubscriber(
  secretKey: string,
  appUserId: string,
  timeoutMs: number,
): Promise<SubscriberLookup> {
  let response: Response;
  try {
    response = await fetch(
      `${SUBSCRIBERS_URL}${encodeURIComponent(appUserId)}`,
      {
        headers: {
          authorization: `Bearer ${secretKey}`,
          accept: 'application/json',
        },
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
  } catch {
    return { status: 'unavailable' };
  }

  if (response.status === 404) {
    return { status: 'not_found' };
  }

  if (!response.ok) {
    return { status: 'unavailable' };
  }

  const body = subscriberSchema.safeParse(
    await response.json<unknown>().catch(() => null),
  );
  return body.success
    ? { status: 'ok', subscriber: body.data.subscriber }
    : { status: 'unavailable' };
}

function isUnexpired(
  expires: string | null | undefined,
  nowMs: number,
): boolean {
  if (expires == null) {
    return true;
  }

  const expiresMs = Date.parse(expires);
  return Number.isFinite(expiresMs) && expiresMs > nowMs;
}

export function hasActiveEntitlement(
  subscriber: Subscriber,
  entitlementIds: string[],
  nowMs: number,
): boolean {
  return entitlementIds.some(id => {
    const grant = subscriber.entitlements[id];
    return grant != null && isUnexpired(grant.expires_date, nowMs);
  });
}

export function ownsActiveSubscription(
  subscriber: Subscriber,
  storeTransactionId: string,
  nowMs: number,
): boolean {
  return Object.values(subscriber.subscriptions).some(
    subscription =>
      subscription.store_transaction_id != null &&
      String(subscription.store_transaction_id) === storeTransactionId &&
      isUnexpired(subscription.expires_date, nowMs),
  );
}
