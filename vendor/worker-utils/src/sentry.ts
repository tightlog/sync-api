import * as Sentry from '@sentry/cloudflare';
import type { CloudflareOptions } from '@sentry/cloudflare';

export interface SentryEnv {
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
}

export interface WorkerSentryPolicy {
  extraDeniedRequestHeaders: readonly string[];
  rpcTracePropagation: boolean;
  /**
   * The SDK collects gen-AI inputs and outputs when `genAI` is omitted, so
   * `true` omits it and `false` turns both off.
   */
  collectGenAIContent: boolean;
  /**
   * The SDK collects database query data when `databaseQueryData` is omitted,
   * so `true` omits it and `false` turns it off.
   */
  collectDatabaseQueryData: boolean;
}

export function workerSentryOptions<E extends SentryEnv>(
  policy: WorkerSentryPolicy,
): (env: E) => CloudflareOptions {
  return env => {
    const dsn = env.SENTRY_DSN?.trim();

    const dataCollection: NonNullable<CloudflareOptions['dataCollection']> = {
      userInfo: false,
      httpBodies: [],
      httpHeaders: {
        request: {
          deny: [
            'authorization',
            'cookie',
            ...policy.extraDeniedRequestHeaders,
          ],
        },
        response: { deny: ['set-cookie'] },
      },
    };
    if (!policy.collectGenAIContent) {
      dataCollection.genAI = { inputs: false, outputs: false };
    }

    if (!policy.collectDatabaseQueryData) {
      dataCollection.databaseQueryData = false;
    }

    const options: CloudflareOptions = {
      dsn: dsn === '' ? undefined : dsn,
      environment: env.SENTRY_ENVIRONMENT,
      enableLogs: true,
      dataCollection,
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
