import { json } from './json';

export interface HealthEnv {
  DEPLOYED_AT?: string;
  DEPLOYED_BY?: string;
  GIT_SHA?: string;
  CF_VERSION_METADATA?: { timestamp: string };
}

export function handleHealth(env: HealthEnv): Response {
  return json({
    ok: true,
    deployedAt:
      env.DEPLOYED_AT ?? env.CF_VERSION_METADATA?.timestamp ?? 'unknown',
    deployedBy: env.DEPLOYED_BY ?? 'unknown',
    gitSha: env.GIT_SHA ?? 'unknown',
  });
}
