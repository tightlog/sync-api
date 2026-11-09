import { isSyncKey } from '@tightlog/protocol/sync';
import { bearerToken } from '@tightlog/worker-utils/clerk';

export function extractSyncKey(request: Request): string | null {
  const token = bearerToken(request.headers.get('authorization'));
  return token && isSyncKey(token) ? token : null;
}
