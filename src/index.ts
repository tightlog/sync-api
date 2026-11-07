import * as Sentry from '@sentry/cloudflare';
import { workerSentryOptions } from '@tightlog/worker-utils';
import 'reflect-metadata';
import { handler } from './handler';
import type { Env } from './types';

const sentryOptions = workerSentryOptions<Env>({
  extraDeniedRequestHeaders: ['x-api-secret'],
  rpcTracePropagation: false,
  collectGenAIContent: true,
  collectDatabaseQueryData: false,
});

export default Sentry.withSentry(sentryOptions, handler);
