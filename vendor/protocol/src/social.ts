import type { AttestErrorCode } from './attest';
import type { RequestErrorCode } from './errors';

export const socialPaths = {
  reviewSession: '/v1/review/session',
  me: '/v1/me',
  feedTerms: '/v1/me/feed-terms',
  feed: '/v1/feed',
  friendsFeed: '/v1/feed/friends',
  spot: '/v1/spot',
  catches: '/v1/catches',
  myCatches: '/v1/catches/mine',
  catch: (id: string) => `/v1/catches/${encodeURIComponent(id)}`,
  reports: '/v1/reports',
  profile: '/v1/profile',
  profileName: '/v1/profile/name',
  publicProfile: (handle: string) =>
    `/v1/profile/${encodeURIComponent(handle)}`,
  media: (key: string) => `/v1/media/${encodeURIComponent(key)}`,
  blocks: '/v1/blocks',
  block: (userId: string) => `/v1/blocks/${encodeURIComponent(userId)}`,
  friends: '/v1/friends',
  friend: (userId: string) => `/v1/friends/${encodeURIComponent(userId)}`,
  friendRequests: '/v1/friends/requests',
  acceptFriendRequest: (userId: string) =>
    `/v1/friends/requests/${encodeURIComponent(userId)}/accept`,
  groups: '/v1/groups',
  joinGroup: '/v1/groups/join',
  group: (groupId: string) => `/v1/groups/${encodeURIComponent(groupId)}`,
  groupPosts: (groupId: string) =>
    `/v1/groups/${encodeURIComponent(groupId)}/posts`,
  leaveGroup: (groupId: string) =>
    `/v1/groups/${encodeURIComponent(groupId)}/members/me`,
  competitions: '/v1/competitions',
  joinCompetition: '/v1/competitions/join',
  publicCompetitions: '/v1/competitions/public',
  competition: (compId: string) =>
    `/v1/competitions/${encodeURIComponent(compId)}`,
  competitionInvite: (compId: string) =>
    `/v1/competitions/${encodeURIComponent(compId)}/invite`,
  competitionEntry: (compId: string) =>
    `/v1/competitions/${encodeURIComponent(compId)}/entry`,
  endCompetition: (compId: string) =>
    `/v1/competitions/${encodeURIComponent(compId)}/end`,
  leaveCompetition: (compId: string) =>
    `/v1/competitions/${encodeURIComponent(compId)}/participants/me`,
  competitionParticipant: (compId: string, userId: string) =>
    `/v1/competitions/${encodeURIComponent(compId)}/participants/${encodeURIComponent(userId)}`,
  reviewCompetitionEntry: (compId: string, userId: string) =>
    `/v1/competitions/${encodeURIComponent(compId)}/entries/${encodeURIComponent(userId)}/review`,
  adminSweep: '/v1/admin/sweep',
  operatorTakedown: '/v1/admin/operator-takedown',
  adminTakedown: (catchId: string) =>
    `/v1/admin/takedown/${encodeURIComponent(catchId)}`,
} as const;

export type SocialErrorCode =
  | AttestErrorCode
  | RequestErrorCode
  | 'already_reported'
  | 'blocked'
  | 'cannot_block_self'
  | 'cannot_friend_self'
  | 'cannot_remove_organiser'
  | 'competition_closed'
  | 'competition_not_found'
  | 'competition_not_started'
  | 'competition_started'
  | 'corrupt_entry'
  | 'empty_body'
  | 'entry_not_found'
  | 'feed_terms_required'
  | 'forbidden'
  | 'handle_not_found'
  | 'handle_required'
  | 'handle_taken'
  | 'invalid_competition'
  | 'invalid_competition_name'
  | 'invalid_decision'
  | 'invalid_display_name'
  | 'invalid_entry'
  | 'invalid_group_name'
  | 'invalid_handle'
  | 'invalid_invite_code'
  | 'invalid_invites'
  | 'invalid_join_code'
  | 'invalid_media_key'
  | 'invalid_name'
  | 'invalid_profile'
  | 'invalid_report'
  | 'invalid_request'
  | 'invalid_user'
  | 'invalid_window'
  | 'invite_code_unavailable'
  | 'invite_not_found'
  | 'join_code_unavailable'
  | 'lat_lng_required'
  | 'media_not_uploaded'
  | 'missing_fields'
  | 'not_a_member'
  | 'not_a_participant'
  | 'not_configured'
  | 'not_owner'
  | 'not_the_organiser'
  | 'request_not_found'
  | 'review_access_denied'
  | 'review_not_required'
  | 'review_token_failed'
  | 'unauthorized'
  | 'unsupported_media_type'
  | 'window_too_long';

export interface SocialErrorBody {
  error: SocialErrorCode;
}

export interface ModeratableFields {
  title: string;
  spotName: string;
  notes: string;
  anglerName: string;
  species: string;
  method: string;
  bait: string;
}

export function moderatableText(fields: ModeratableFields): string {
  return [
    fields.anglerName,
    fields.title,
    fields.species,
    fields.spotName,
    fields.method,
    fields.bait,
    fields.notes,
  ]
    .map(part => part.trim())
    .filter(part => part !== '')
    .join('\n');
}

export function moderationMaterial(
  fields: ModeratableFields,
  mediaKey: string | null,
  mediaEtag: string | null,
): string {
  return `${moderatableText(fields)} ${mediaKey ?? ''} ${mediaEtag ?? ''}`;
}

export function socialAttestChallenge(method: string, path: string): string {
  return `${method}\n${path}`;
}

export async function moderationHash(
  fields: ModeratableFields,
  mediaKey: string | null,
  mediaEtag: string | null,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(moderationMaterial(fields, mediaKey, mediaEtag)),
  );
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}
