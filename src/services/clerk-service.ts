import { createClerkClient } from '@clerk/backend';
import type { Env } from '../types';
import { json } from '@tightlog/worker-utils';
import { verifyClerkToken } from '@tightlog/worker-utils/clerk';
import type { SyncErrorBody } from '@tightlog/protocol/sync';

export type ClerkIdentity = {
  clerkUserId: string;
  email: string | null;
  accountName: string | null;
};

const clerkClients = new Map<string, ReturnType<typeof createClerkClient>>();

function clerkClient(secretKey: string): ReturnType<typeof createClerkClient> {
  let client = clerkClients.get(secretKey);
  if (!client) {
    client = createClerkClient({ secretKey });
    clerkClients.set(secretKey, client);
  }

  return client;
}

export const clerkService = {
  verifyIdentity: async (
    env: Env,
    token: string,
  ): Promise<ClerkIdentity | Response> => {
    const verdict = await verifyClerkToken(token, env);
    if (!verdict.ok) {
      return verdict.reason === 'not_configured'
        ? json<SyncErrorBody>({ error: 'not_configured' }, 501)
        : json<SyncErrorBody>({ error: 'unauthorized' }, 401);
    }

    const sub = verdict.userId;
    try {
      // SAFETY: not_configured above guarantees the key is set here.
      const user = await clerkClient(
        env.CLERK_SECRET_KEY as string,
      ).users.getUser(sub);
      const email =
        user.primaryEmailAddress?.emailAddress ??
        user.emailAddresses[0]?.emailAddress ??
        null;
      const accountName = user.fullName?.trim() ?? null;
      return { clerkUserId: sub, email, accountName };
    } catch {
      return { clerkUserId: sub, email: null, accountName: null };
    }
  },
};
