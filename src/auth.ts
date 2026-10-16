import { sha256Hex } from './utils/sha256Hex';

const SYNC_KEY_PREFIX = 'logbook-key-';
const SYNC_KEY_HEX = /^[0-9a-f]{64}$/;

export function isSyncKey(token: string): boolean {
  return (
    token.startsWith(SYNC_KEY_PREFIX) &&
    SYNC_KEY_HEX.test(token.slice(SYNC_KEY_PREFIX.length))
  );
}

export function extractSyncKey(request: Request): string | null {
  const header = request.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  return token && isSyncKey(token) ? token : null;
}

export async function requireKeyHash(
  request: Request,
): Promise<string | Response> {
  const token = extractSyncKey(request);
  if (!token) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  return sha256Hex(token);
}
