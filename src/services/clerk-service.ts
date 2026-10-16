import { createClerkClient, verifyToken } from '@clerk/backend';
import type { Env } from '../types';

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
    const secretKey = env.CLERK_SECRET_KEY;
    if (!secretKey) {
      return Response.json({ error: 'not_configured' }, { status: 501 });
    }

    let sub: string;
    try {
      const payload = await verifyToken(token, {
        secretKey,
        jwtKey: env.CLERK_JWT_KEY,
      });

      if (!payload.sub) {
        return Response.json({ error: 'unauthorized' }, { status: 401 });
      }
      sub = payload.sub;
    } catch {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }
    try {
      const user = await clerkClient(secretKey).users.getUser(sub);
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
