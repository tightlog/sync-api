import * as Sentry from '@sentry/cloudflare';
import { workerSentryOptions } from '@tightlog/worker-utils';
import { handler } from './handler';
import type { Env } from './types';

const sentryOptions = workerSentryOptions<Env>();

export default Sentry.withSentry(sentryOptions, handler);
