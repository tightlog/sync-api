import type { SyncRepo } from '../../repo';
import type { SyncUser } from '../../types';

export async function adoptIdentity(
  repo: SyncRepo,
  linked: SyncUser,
  keyHash: string,
): Promise<Response> {
  if (linked.keyHash === keyHash) {
    return Response.json({ userId: linked.id });
  }

  const current = await repo.getOrCreateUser(keyHash);
  if (await repo.userHasData(current.id)) {
    return Response.json({ error: 'existing_data' }, { status: 409 });
  }

  await repo.rekeyUser(linked, keyHash, current.id);
  return Response.json({ userId: linked.id });
}
