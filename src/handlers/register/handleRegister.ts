import { getDb } from '../../db';
import type { UserMeta } from '../../repo';
import { SyncRepo } from '../../repo';
import { isAppUserId } from '../../revenuecat';
import { clerkService } from '../../services/clerk-service';
import type { Env } from '../../types';
import { authenticate } from '../../utils/authenticate';
import { parseBody } from '../../validation/parseBody';
import { metaBodyLimit, registerSchema } from '../../validation/register';

export async function handleRegister(
  request: Request,
  env: Env,
): Promise<Response> {
  const keyHash = await authenticate(request, env, env.SYNC_RATE_LIMITER);

  if (keyHash instanceof Response) {
    return keyHash;
  }

  const input = await parseBody(request, metaBodyLimit, registerSchema);

  if (input instanceof Response) {
    return input;
  }

  const repo = new SyncRepo(getDb(env));
  const [user, identity] = await Promise.all([
    repo.getOrCreateUser(keyHash),
    input.clerkToken
      ? clerkService.verifyIdentity(env, input.clerkToken)
      : null,
  ]);

  const meta: UserMeta = {
    anglerName: input.anglerName,
  };

  if (identity) {
    if (identity instanceof Response) {
      return identity;
    }

    const linkedElsewhere = await repo.getUserByClerkId(identity.clerkUserId);
    if (linkedElsewhere && linkedElsewhere.id !== user.id) {
      return Response.json(
        { error: 'clerk_linked_elsewhere' },
        { status: 409 },
      );
    }
    meta.clerkUserId = identity.clerkUserId;
    meta.email = identity.email;
    meta.accountName = identity.accountName;
  }

  const statements = [repo.updateUserMeta(user.id, meta)];

  const { revenueCatAppUserId } = input;

  // Only the device's own sync identity hash may be claimed. Arbitrary ids
  // would let a first writer poison purchase restore for someone else.
  if (
    revenueCatAppUserId &&
    isAppUserId(revenueCatAppUserId) &&
    revenueCatAppUserId === keyHash
  ) {
    statements.push(repo.claimRevenueCatId(user.id, revenueCatAppUserId));
  }

  if (input.deviceId) {
    statements.push(
      repo.upsertDevice(user.id, {
        deviceId: input.deviceId,
        platform: input.platform,
        model: input.model,
        osName: input.osName,
        osVersion: input.osVersion,
        appVersion: input.appVersion,
      }),
    );
  }

  await repo.batch(statements);

  return Response.json({
    userId: user.id,
    hasKeyEscrow: user.keyEscrow !== null,
  });
}
