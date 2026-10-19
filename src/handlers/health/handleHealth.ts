import { json } from '@tightlog/worker-utils';
import type { Env } from '../../types';

export function handleHealth(env: Env) {
  return json({
    ok: true,
    deployedAt:
      env.DEPLOYED_AT ?? env.CF_VERSION_METADATA?.timestamp ?? 'unknown',
    deployedBy: env.DEPLOYED_BY ?? 'unknown',
    gitSha: env.GIT_SHA ?? 'unknown',
  });
}
