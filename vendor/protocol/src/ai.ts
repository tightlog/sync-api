import type { AttestErrorCode } from './attest';
import type { RequestErrorCode } from './errors';

export const AI_SECRET_HEADER = 'x-api-secret';

export const AI_APP_USER_HEADER = 'x-rc-app-user-id';

export const aiPaths = {
  coachChat: '/api/coach-chat',
  coachTools: '/api/coach-tools',
  identifyFish: '/api/identify-fish',
  textToImage: '/api/text-to-image',
  textAndImageToImage: '/api/text-and-image-to-image',
  multiTurnGenerate: '/api/multi-turn-generate',
  revenueCatWebhook: '/webhook/revenuecat',
} as const;

export type AiErrorCode =
  | AttestErrorCode
  | RequestErrorCode
  | 'invalid_event'
  | 'not_configured'
  | 'unauthorized';

export interface AiErrorBody {
  error: AiErrorCode;
}

export type AiRefusalReason = 'prohibited_prompt' | 'screening_unavailable';

export interface AiRefusalBody {
  success: false;
  error: string;
  retryable: boolean;
  reason: AiRefusalReason;
  category?: string;
}
