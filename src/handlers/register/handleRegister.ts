import type { RegisterResponse, SyncErrorBody } from '@tightlog/protocol/sync';
import { json, parseJsonBody } from '@tightlog/worker-utils';
import { getDb } from '../../db';
import type { UserMeta } from '../../repo';
import { SyncRepo } from '../../repo';
import { canClaimRevenueCatId } from '../../revenuecat';
import { clerkService } from '../../services/clerk-service';
import type { Env } from '../../types';
import { authenticate } from '../../utils/authenticate';
import { metaBodyLimit, registerSchema } from '../../validation/register';

export async function handleRegister(
  request: Request,
  env: Env,
): Promise<Response> {
  const keyHash = await authenticate(request, env, env.SYNC_RATE_LIMITER);

  if (keyHash instanceof Response) {
    return keyHash;
  }

  const input = await parseJsonBody(request, metaBodyLimit, registerSchema);

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
      return json<SyncErrorBody>({ error: 'clerk_linked_elsewhere' }, 409);
    }

    meta.clerkUserId = identity.clerkUserId;
    meta.email = identity.email;
    meta.accountName = identity.accountName;
  }

  const statements = [repo.updateUserMeta(user.id, meta)];

  const { revenueCatAppUserId } = input;

  if (
    canClaimRevenueCatId(
      revenueCatAppUserId,
      keyHash,
      env.E2E_REVENUECAT_APP_USER_ID,
    )
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

  const response: RegisterResponse = {
    userId: user.id,
    hasKeyEscrow: user.keyEscrow !== null,
  };
  return json(response);
}
