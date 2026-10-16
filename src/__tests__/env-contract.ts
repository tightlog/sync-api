import type { Env } from '../types';

type MustBeNever<T extends never> = T;

export type BindingsMissingFromEnvType = MustBeNever<
  Exclude<keyof Cloudflare.Env, keyof Env>
>;
