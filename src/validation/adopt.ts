import type {
  AdoptClerkBody,
  AdoptPurchaseBody,
} from '@tightlog/protocol/sync';
import { z } from 'zod';

export const adoptSchema = z.object({
  clerkToken: z.string().catch(''),
} satisfies Record<keyof AdoptClerkBody, z.ZodType>);

export const adoptPurchaseSchema = z.object({
  appUserId: z.string().catch(''),
  storeTransactionId: z.string().catch(''),
} satisfies Record<keyof AdoptPurchaseBody, z.ZodType>);
