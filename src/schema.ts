import { SCHEMA_VERSION_HEADER } from '@tightlog/protocol/sync';
import { json } from '@tightlog/worker-utils';
import type { SyncErrorBody } from '@tightlog/protocol/sync';

const MIN_SUPPORTED_SCHEMA_VERSION = 1;

export function schemaVersionError(request: Request): Response | null {
  const raw = request.headers.get(SCHEMA_VERSION_HEADER);
  if (raw === null) {
    return null;
  }

  const version = Number(raw);
  if (!Number.isInteger(version) || version < MIN_SUPPORTED_SCHEMA_VERSION) {
    return json<SyncErrorBody>({ error: 'schema_outdated' }, 426);
  }

  return null;
}
