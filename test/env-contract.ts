import type { EnvContract } from '@tightlog/worker-utils';
import type { Env } from '../src/types';

export const envContract: EnvContract<Cloudflare.Env, Env> = true;
