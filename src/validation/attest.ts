import { z } from 'zod';

export const attestBodyLimit = 128 * 1024;

export const attestRegisterSchema = z.object({
  keyId: z.string().min(1).max(1024),
  attestation: z
    .string()
    .min(1)
    .max(64 * 1024),
  challenge: z.string().min(1).max(1024),
});
