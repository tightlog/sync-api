import type { Value } from '@libsql/client/web';
import { z } from 'zod';
import type { SqlRow } from './db';
import type { SyncRow } from './types';

export const MAX_PUSH_ROWS = 100;
export const MAX_FUTURE_SKEW_MS = 60_000;

const MAX_STRING = 10_000;
const MAX_MEDIA_POSITION = 5;

type DbValue = string | number | null;
type SyncValue = string | number | boolean | null;

type Field = {
  column: string;
  toDb: (value: unknown) => DbValue;
  fromDb: (value: Value) => SyncValue;
};

const syncValueSchema = z
  .union([z.string(), z.number(), z.boolean(), z.null()])
  .catch(null);

export const syncRowSchema = z.record(z.string(), syncValueSchema).catch({});

export type SyncRowInput = z.infer<typeof syncRowSchema>;

export type SanitizedRow = {
  id: string;
  updatedAtMs: number;
  deletedAt: string | null;
  values: DbValue[];
};

function clip(value: string): string {
  return value.slice(0, MAX_STRING);
}

function text(column: string): Field {
  return {
    column,
    toDb: value => (typeof value === 'string' ? clip(value) : ''),
    fromDb: value => (typeof value === 'string' ? value : ''),
  };
}

function textOrNull(column: string): Field {
  return {
    column,
    toDb: value => (typeof value === 'string' ? clip(value) : null),
    fromDb: value => (typeof value === 'string' ? value : null),
  };
}

function real(column: string): Field {
  return {
    column,
    toDb: value => (typeof value === 'number' ? value : null),
    fromDb: value => (typeof value === 'number' ? value : null),
  };
}

function bool(column: string, fallback: 0 | 1 = 0): Field {
  return {
    column,
    toDb: value => (typeof value === 'boolean' ? (value ? 1 : 0) : fallback),
    fromDb: value => value === 1,
  };
}

function boundedInt(column: string, max: number): Field {
  return {
    column,
    toDb: value => {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 0;
      }
      return Math.min(Math.max(Math.trunc(value), 0), max);
    },
    fromDb: value => (typeof value === 'number' ? value : 0),
  };
}

function oneOf(
  column: string,
  allowed: readonly string[],
  fallback: string,
): Field {
  return {
    column,
    toDb: value =>
      typeof value === 'string' && allowed.includes(value) ? value : fallback,
    fromDb: value => (typeof value === 'string' ? value : fallback),
  };
}

// Field name → column codec. Order is the bind / SELECT column order.
const TABLE_FIELDS = {
  catches: {
    species: text('species'),
    weightKg: real('weight_kg'),
    lengthCm: real('length_cm'),
    caughtAt: text('caught_at'),
    spotId: textOrNull('spot_id'),
    sessionId: textOrNull('session_id'),
    method: text('method'),
    weather: text('weather'),
    airTempC: real('air_temp_c'),
    windKph: real('wind_kph'),
    pressureHpa: real('pressure_hpa'),
    latitude: real('latitude'),
    longitude: real('longitude'),
    released: bool('released'),
    landed: bool('landed', 1),
    pinned: bool('pinned'),
    bait: text('bait'),
    hookBait: text('hook_bait'),
    rigId: textOrNull('rig_uuid'),
    notes: text('notes'),
    createdAt: text('created_at'),
  },
  spots: {
    name: text('name'),
    waterType: text('water_type'),
    latitude: real('latitude'),
    longitude: real('longitude'),
    notes: text('notes'),
    createdAt: text('created_at'),
  },
  sessions: {
    name: textOrNull('name'),
    startedAt: text('started_at'),
    endedAt: textOrNull('ended_at'),
    notes: text('notes'),
    rodCount: real('rod_count'),
    setup: text('setup'),
    createdAt: text('created_at'),
  },
  catch_media: {
    catchId: text('catch_id'),
    basename: text('basename'),
    kind: oneOf('kind', ['photo', 'video'], 'photo'),
    position: boundedInt('position', MAX_MEDIA_POSITION),
    createdAt: text('created_at'),
  },
};

export type SyncTable = keyof typeof TABLE_FIELDS;

export const SYNC_TABLES = Object.keys(TABLE_FIELDS) as SyncTable[];

export function isSyncTable(value: string): value is SyncTable {
  return Object.hasOwn(TABLE_FIELDS, value);
}

function fields(table: SyncTable): [string, Field][] {
  return Object.entries(TABLE_FIELDS[table]);
}

export function dataColumns(table: SyncTable): string[] {
  return fields(table).map(([, field]) => field.column);
}

const MEDIA_BASENAME_INDEX = fields('catch_media').findIndex(
  ([name]) => name === 'basename',
);

export function sanitizeRow(
  table: SyncTable,
  row: SyncRowInput,
  nowMs?: number,
): SanitizedRow | null {
  const id = typeof row.id === 'string' ? row.id.slice(0, 128) : '';

  let updatedAtMs =
    typeof row.updatedAt === 'number' && Number.isFinite(row.updatedAt)
      ? Math.trunc(row.updatedAt)
      : null;

  if (!id || updatedAtMs === null || updatedAtMs <= 0) {
    return null;
  }

  if (nowMs !== undefined && Number.isFinite(nowMs)) {
    const ceiling = Math.trunc(nowMs) + MAX_FUTURE_SKEW_MS;
    if (updatedAtMs > ceiling) {
      updatedAtMs = ceiling;
    }
  }

  return {
    id,
    updatedAtMs,
    deletedAt: typeof row.deletedAt === 'string' ? clip(row.deletedAt) : null,
    values: fields(table).map(([name, field]) => field.toDb(row[name])),
  };
}

export function syncRowFromDb(table: SyncTable, dbRow: SqlRow): SyncRow {
  const syncRow: SyncRow = {
    id: typeof dbRow.id === 'string' ? dbRow.id : '',
    updatedAt:
      typeof dbRow.updated_at_ms === 'number' ? dbRow.updated_at_ms : 0,
  };

  for (const [name, field] of fields(table)) {
    syncRow[name] = field.fromDb(dbRow[field.column]);
  }

  syncRow.deletedAt =
    typeof dbRow.deleted_at === 'string' ? dbRow.deleted_at : null;
  return syncRow;
}

export function mediaBasenameOf(row: SanitizedRow): string | null {
  const value = row.values[MEDIA_BASENAME_INDEX];
  return typeof value === 'string' && value ? value : null;
}
