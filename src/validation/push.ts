import { z } from 'zod';
import { syncRowSchema } from '../tables';

export const pushBodyLimit = 1 * 1024 * 1024;

export const pushSchema = z.object({
  items: z.array(syncRowSchema).nullable().catch(null),
});
