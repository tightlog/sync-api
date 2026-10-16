import { z } from 'zod';

export const recoveryNoticesAckSchema = z.object({
  ids: z.array(z.string().catch('')).nullable().catch(null),
});
