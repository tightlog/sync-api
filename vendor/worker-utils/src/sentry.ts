import * as Sentry from '@sentry/cloudflare';
import type { CloudflareOptions } from '@sentry/cloudflare';

export interface SentryEnv {
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
}

export interface WorkerSentryPolicy {
  extraDeniedRequestHeaders?: readonly string[];
  rpcTracePropagation?: boolean;
}

export function workerSentryOptions<E extends SentryEnv>(
  policy: WorkerSentryPolicy = {},
): (env: E) => CloudflareOptions {
  return env => {
    const dsn = env.SENTRY_DSN?.trim();
    const options: CloudflareOptions = {
      dsn: dsn === '' ? undefined : dsn,
      environment: env.SENTRY_ENVIRONMENT,
      enableLogs: true,
      dataCollection: {
        userInfo: false,
        httpBodies: [],
        httpHeaders: {
          request: {
            deny: [
              'authorization',
              'cookie',
              ...(policy.extraDeniedRequestHeaders ?? []),
            ],
          },
          response: { deny: ['set-cookie'] },
        },
        genAI: { inputs: false, outputs: false },
        databaseQueryData: false,
      },
      integrations: [
        Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
      ],
    };
    if (policy.rpcTracePropagation) {
      options.enableRpcTracePropagation = true;
    }

    return options;
  };
}
