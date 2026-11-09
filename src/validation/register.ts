import type { RegisterBody } from '@tightlog/protocol/sync';
import { z } from 'zod';

export const metaBodyLimit = 32 * 1024;
const META_STRING = 256;

const metaStringSchema = z
  .string()
  .catch('')
  .transform(value => value.trim().slice(0, META_STRING) || null);

export const registerSchema = z.object({
  anglerName: metaStringSchema,
  clerkToken: z.string().catch(''),
  revenueCatAppUserId: metaStringSchema,
  deviceId: metaStringSchema,
  platform: metaStringSchema,
  model: metaStringSchema,
  osName: metaStringSchema,
  osVersion: metaStringSchema,
  appVersion: metaStringSchema,
} satisfies Record<keyof RegisterBody, z.ZodType>);
