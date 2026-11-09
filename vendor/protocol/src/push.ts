import { z } from 'zod';
import { jsonValueSchema } from './json';
import type { JsonValue } from './json';

export const PUSH_SECRET_HEADER = 'x-push-secret';

export const PUSH_CONSUMER_HEADER = 'x-consumer';

export const pushPaths = {
  devices: '/v1/devices',
  send: '/v1/send',
  reminders: '/v1/reminders',
  reminder: (compId: string) => `/v1/reminders/${encodeURIComponent(compId)}`,
  oneshot: '/notifications/oneshot',
} as const;

export const PUSH_EVENTS = [
  'friend.request',
  'friend.accepted',
  'competition.invite',
  'competition.open',
  'competition.results',
] as const;

export type PushEvent = (typeof PUSH_EVENTS)[number];

export const CHANNELS = ['internal', 'testflight', 'production'] as const;

export type Channel = (typeof CHANNELS)[number];

export const MAX_RECIPIENTS = 1000;

export type PushData = Record<string, JsonValue>;

export interface CompetitionPushData extends PushData {
  compId: string;
}

export const payloadSchema = z
  .object({
    title: z.string().catch(''),
    body: z.string().catch(''),
    data: z.record(z.string(), jsonValueSchema).optional().catch(undefined),
  })
  .catch({ title: '', body: '', data: undefined });

export type PushPayload = z.infer<typeof payloadSchema>;

export const sendBodySchema = z.object({
  event: z.enum(PUSH_EVENTS),
  userIds: z.array(z.string()).min(1),
  audiences: z.array(z.enum(CHANNELS)).optional(),
  payload: payloadSchema,
});

export type SendBody = z.infer<typeof sendBodySchema>;

export interface SendResult {
  sent: number;
  pruned: number;
  skipped: number;
  failed: number;
}

export interface ReminderBody {
  compId: string;
  name: string;
  startsAt: string;
  endsAt?: string;
  userIds: string[];
}

export interface ReminderResult {
  scheduled: boolean;
  count: number;
}

export interface CancelRemindersResult {
  cancelled: number;
}

export const oneshotBodySchema = z.object({
  audiences: z.array(z.enum(CHANNELS)).min(1),
  confirmProduction: z.boolean().catch(false),
  confirmLarge: z.boolean().catch(false),
  payload: payloadSchema,
});

export type OneshotBody = z.infer<typeof oneshotBodySchema>;

export interface OneshotResult {
  sent: number;
  skipped: number;
  pruned: number;
  matchedDevices: number;
}

export interface DeviceRegistration {
  externalId: string;
  platform: 'ios' | 'android';
  events: PushEvent[];
  channel?: Channel;
}

export interface UnregisterBody {
  externalId: string;
}
