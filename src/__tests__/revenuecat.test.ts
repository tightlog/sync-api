import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  hasActiveEntitlement,
  isAppUserId,
  ownsActiveSubscription,
} from '../revenuecat';
import { revenueCatService } from '../services/revenuecat-service';
import type { Env } from '../types';

const NOW = Date.parse('2026-07-27T12:00:00.000Z');
const APP_USER_ID = '$RCAnonymousID:8f3c2b1a4d5e6f708192a3b4c5d6e7f8';
const TXN = '1000000652379790';

function env(overrides: Partial<Env> = {}): Env {
  return {
    TURSO_DATABASE_URL: 'libsql://test',
    SENTRY_DSN: '',
    SENTRY_ENVIRONMENT: 'test',
    REVENUECAT_SECRET_API_KEY: 'sk_test',
    ...overrides,
  };
}

function statusOf(result: true | Response): number | null {
  return result instanceof Response ? result.status : null;
}

function entitledSubscriber(txn = TXN) {
  return {
    subscriber: {
      entitlements: { pro: { expires_date: null } },
      subscriptions: {
        annual: {
          expires_date: null,
          store_transaction_id: txn,
        },
      },
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

function stubFetch(response: Response | Error) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(() =>
      response instanceof Error
        ? Promise.reject(response)
        : Promise.resolve(response),
    );
}

describe('isAppUserId', () => {
  test('accepts the shapes RevenueCat actually mints', () => {
    expect(isAppUserId(APP_USER_ID)).toBe(true);
    expect(isAppUserId('user_2abc.DEF-123@example.com')).toBe(true);
  });

  test('rejects anything that could steer the request elsewhere', () => {
    expect(isAppUserId('../subscribers/someone-else')).toBe(false);
    expect(isAppUserId('has space')).toBe(false);
    expect(isAppUserId('short')).toBe(false);
    expect(isAppUserId('a'.repeat(129))).toBe(false);
    expect(isAppUserId('')).toBe(false);
  });
});

describe('hasActiveEntitlement', () => {
  test('a lifetime entitlement has no expiry and stays active', () => {
    expect(
      hasActiveEntitlement(
        { subscriber: { entitlements: { pro: { expires_date: null } } } },
        NOW,
      ),
    ).toBe(true);
  });

  test('an unexpired entitlement is active', () => {
    expect(
      hasActiveEntitlement(
        {
          subscriber: {
            entitlements: { pro: { expires_date: '2026-08-01T00:00:00Z' } },
          },
        },
        NOW,
      ),
    ).toBe(true);
  });

  test('a lapsed subscription is not a restore credential', () => {
    expect(
      hasActiveEntitlement(
        {
          subscriber: {
            entitlements: { pro: { expires_date: '2026-07-01T00:00:00Z' } },
          },
        },
        NOW,
      ),
    ).toBe(false);
  });

  test('a customer with no entitlements at all is not active', () => {
    expect(
      hasActiveEntitlement({ subscriber: { entitlements: {} } }, NOW),
    ).toBe(false);

    expect(hasActiveEntitlement({}, NOW)).toBe(false);
  });
});

describe('ownsActiveSubscription', () => {
  test('matches an active subscription by store transaction id', () => {
    expect(ownsActiveSubscription(entitledSubscriber(), TXN, NOW)).toBe(true);
  });

  test('refuses a mismatched transaction id', () => {
    expect(
      ownsActiveSubscription(entitledSubscriber('victims-txn'), TXN, NOW),
    ).toBe(false);
  });

  test('refuses an expired subscription even when the transaction matches', () => {
    expect(
      ownsActiveSubscription(
        {
          subscriber: {
            subscriptions: {
              annual: {
                expires_date: '2026-07-01T00:00:00Z',
                store_transaction_id: TXN,
              },
            },
          },
        },
        TXN,
        NOW,
      ),
    ).toBe(false);
  });
});

describe('verifyPurchaseIdentity', () => {
  test('is unconfigured without the secret rather than open', async () => {
    const result = await revenueCatService.verifyPurchaseIdentity(
      env({ REVENUECAT_SECRET_API_KEY: undefined }),
      APP_USER_ID,
      TXN,
      NOW,
    );
    expect(statusOf(result)).toBe(501);
  });

  test('rejects a malformed app user id before calling out', async () => {
    const fetchSpy = stubFetch(new Response('{}'));
    const result = await revenueCatService.verifyPurchaseIdentity(
      env(),
      '../evil',
      TXN,
      NOW,
    );
    expect(statusOf(result)).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('refuses when no transaction id proves ownership', async () => {
    const fetchSpy = stubFetch(new Response('{}'));
    const result = await revenueCatService.verifyPurchaseIdentity(
      env(),
      APP_USER_ID,
      '',
      NOW,
    );
    expect(statusOf(result)).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('an unknown customer is a 404, not an adoption', async () => {
    stubFetch(new Response('{}', { status: 404 }));
    const result = await revenueCatService.verifyPurchaseIdentity(
      env(),
      APP_USER_ID,
      TXN,
      NOW,
    );
    expect(statusOf(result)).toBe(404);
  });

  test('a real but un-entitled customer is refused', async () => {
    stubFetch(
      Response.json({
        subscriber: {
          entitlements: { pro: { expires_date: '2026-07-01T00:00:00Z' } },
          subscriptions: {},
        },
      }),
    );

    const result = await revenueCatService.verifyPurchaseIdentity(
      env(),
      APP_USER_ID,
      TXN,
      NOW,
    );
    expect(statusOf(result)).toBe(403);
  });

  test('an entitled customer whose purchase the caller does not hold is refused', async () => {
    stubFetch(Response.json(entitledSubscriber('victims-txn')));

    const result = await revenueCatService.verifyPurchaseIdentity(
      env(),
      APP_USER_ID,
      TXN,
      NOW,
    );
    expect(statusOf(result)).toBe(403);
  });

  test('an entitled customer who holds the purchase verifies', async () => {
    const fetchSpy = stubFetch(Response.json(entitledSubscriber()));

    const result = await revenueCatService.verifyPurchaseIdentity(
      env(),
      APP_USER_ID,
      TXN,
      NOW,
    );
    expect(result).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];

    expect(url).toBe(
      'https://api.revenuecat.com/v1/subscribers/%24RCAnonymousID%3A8f3c2b1a4d5e6f708192a3b4c5d6e7f8',
    );
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer sk_test',
    );
  });

  test('a RevenueCat outage fails', async () => {
    stubFetch(new Error('network down'));
    const result = await revenueCatService.verifyPurchaseIdentity(
      env(),
      APP_USER_ID,
      TXN,
      NOW,
    );
    expect(statusOf(result)).toBe(502);
  });
});
