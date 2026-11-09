import { json } from '@tightlog/worker-utils';
import type { SyncRepo } from '../../repo';
import type { SyncUser } from '../../types';
import type { SyncErrorBody } from '@tightlog/protocol/sync';

export async function adoptIdentity(
  repo: SyncRepo,
  linked: SyncUser,
  keyHash: string,
): Promise<Response> {
  if (linked.keyHash === keyHash) {
    return json({ userId: linked.id });
  }

  const current = await repo.getOrCreateUser(keyHash);
  if (await repo.userHasData(current.id)) {
    return json<SyncErrorBody>({ error: 'existing_data' }, 409);
  }

  await repo.rekeyUser(linked, keyHash, current.id);
  return json({ userId: linked.id });
}
