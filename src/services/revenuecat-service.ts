import {
  hasActiveEntitlement,
  isAppUserId,
  isStoreTransactionId,
  ownsActiveSubscription,
} from '../revenuecat';
import type { SubscriberResponse } from '../revenuecat';
import type { Env } from '../types';

const REVENUECAT_API_BASE_URL = 'https://api.revenuecat.com/v1/subscribers';

export const revenueCatService = {
  verifyPurchaseIdentity: async (
    env: Env,
    appUserId: string,
    storeTransactionId: string,
    nowMs: number,
  ): Promise<true | Response> => {
    const secret = env.REVENUECAT_SECRET_API_KEY;
    if (!secret) {
      return Response.json({ error: 'not_configured' }, { status: 501 });
    }

    if (!isAppUserId(appUserId)) {
      return Response.json({ error: 'invalid_app_user_id' }, { status: 400 });
    }

    if (!storeTransactionId || !isStoreTransactionId(storeTransactionId)) {
      return Response.json({ error: 'transaction_required' }, { status: 400 });
    }

    let response: Response;
    try {
      response = await fetch(
        `${REVENUECAT_API_BASE_URL}/${encodeURIComponent(appUserId)}`,
        {
          headers: {
            authorization: `Bearer ${secret}`,
            accept: 'application/json',
          },
        },
      );
    } catch {
      return Response.json(
        { error: 'revenuecat_unreachable' },
        { status: 502 },
      );
    }

    if (response.status === 404) {
      return Response.json({ error: 'unknown_customer' }, { status: 404 });
    }

    if (!response.ok) {
      return Response.json(
        { error: 'revenuecat_unreachable' },
        { status: 502 },
      );
    }

    let body: SubscriberResponse;
    try {
      body = await response.json();
    } catch {
      return Response.json(
        { error: 'revenuecat_unreachable' },
        { status: 502 },
      );
    }

    if (!hasActiveEntitlement(body, nowMs)) {
      return Response.json({ error: 'no_active_entitlement' }, { status: 403 });
    }

    if (!ownsActiveSubscription(body, storeTransactionId, nowMs)) {
      return Response.json({ error: 'purchase_not_owned' }, { status: 403 });
    }

    return true;
  },
};
