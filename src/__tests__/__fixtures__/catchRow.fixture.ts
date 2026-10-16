import { sanitizeRow } from '../../tables';
import type { SanitizedRow, SyncRowInput } from '../../tables';

export function catchRow(
  id: string,
  updatedAt: number,
  overrides: SyncRowInput = {},
): SanitizedRow {
  const row = sanitizeRow('catches', {
    id,
    updatedAt,
    species: 'Tench',
    caughtAt: '2026-08-19T08:00:00.000Z',
    createdAt: '2026-08-19T08:00:00.000Z',
    ...overrides,
  });
  if (!row) {
    throw new Error(`row ${id} did not sanitize`);
  }
  return row;
}
