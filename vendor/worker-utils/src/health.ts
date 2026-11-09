import { json } from './json';

export interface HealthEnv {
  DEPLOYED_AT?: string;
  DEPLOYED_BY?: string;
  GIT_SHA?: string;
  CF_VERSION_METADATA?: { timestamp: string };
}

export interface VersionEnv extends HealthEnv {
  SERVICE_VERSION?: string;
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

export function handleVersion(env: VersionEnv): Response {
  return json({
    version: env.SERVICE_VERSION ?? 'unknown',
    deployedAt: env.DEPLOYED_AT ?? 'unknown',
    deployedBy: env.DEPLOYED_BY ?? 'unknown',
    gitSha: env.GIT_SHA ?? 'unknown',
  });
}
