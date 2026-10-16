import type { CloudflareOptions } from '@sentry/cloudflare';
import * as Sentry from '@sentry/cloudflare';
import 'reflect-metadata';
import { handler } from './handler';
import type { Env } from './types';

function sentryOptions(env: Env): CloudflareOptions {
  const dsn = env.SENTRY_DSN?.trim();
  return {
    dsn: dsn === '' ? undefined : dsn,
    environment: env.SENTRY_ENVIRONMENT,
    enableLogs: true,
    dataCollection: {
      userInfo: false,
      httpBodies: [],
      httpHeaders: {
        request: {
          deny: ['authorization', 'cookie', 'x-api-secret'],
        },
        response: { deny: ['set-cookie'] },
      },
      databaseQueryData: false,
    },
    integrations: [
      Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
    ],
  };
}

export default Sentry.withSentry(sentryOptions, handler);
