import { z } from 'zod';

export const mediaStatusBodyLimit = 64 * 1024;

export const mediaStatusSchema = z.object({
  names: z.array(z.string().catch('')).nullable().catch(null),
});
