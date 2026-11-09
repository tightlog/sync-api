import * as Sentry from '@sentry/cloudflare';

export async function bestEffort<T>(
  context: string,
  work: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await work();
  } catch (error) {
    Sentry.captureException(error, { tags: { best_effort: context } });
    return undefined;
  }
}
