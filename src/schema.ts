const MIN_SUPPORTED_SCHEMA_VERSION = 1;

const HEADER = 'x-tightlog-schema-version';

export function schemaVersionError(request: Request): Response | null {
  const raw = request.headers.get(HEADER);
  if (raw === null) {
    return null;
  }

  const version = Number(raw);
  if (!Number.isInteger(version) || version < MIN_SUPPORTED_SCHEMA_VERSION) {
    return Response.json({ error: 'schema_outdated' }, { status: 426 });
  }
  return null;
}
