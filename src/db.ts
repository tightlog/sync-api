import type { Env } from './types';
import { createLibsqlDb } from '@tightlog/worker-utils/libsql';
import type {
  BindValue,
  Db,
  SqlRow,
  Statement,
} from '@tightlog/worker-utils/libsql';

export type { BindValue, SqlRow };

export type SyncStatement = Statement;

export type SyncDb = Db;

export function getDb(env: Env): SyncDb {
  return createLibsqlDb(env);
}
