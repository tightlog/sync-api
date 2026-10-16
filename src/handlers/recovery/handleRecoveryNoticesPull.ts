import { getDb } from '../../db';
import { SyncRepo } from '../../repo';
import type { Env } from '../../types';
import { authenticate } from '../../utils/authenticate';

export async function handleRecoveryNoticesPull(
  request: Request,
  env: Env,
): Promise<Response> {
  const keyHash = await authenticate(request, env, env.SYNC_RATE_LIMITER);
  if (keyHash instanceof Response) {
    return keyHash;
  }

  const notices = await new SyncRepo(getDb(env)).listUnreadRecoveryNotices(
    keyHash,
  );
  return Response.json({
    items: notices.map(notice => ({
      id: notice.id,
      kind: notice.kind,
      createdAt: notice.created_at,
    })),
  });
}
