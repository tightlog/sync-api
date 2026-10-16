import { z } from 'zod';

export const adoptSchema = z.object({
  clerkToken: z.string().catch(''),
});

export const adoptPurchaseSchema = z.object({
  appUserId: z.string().catch(''),
  storeTransactionId: z.string().catch(''),
});
