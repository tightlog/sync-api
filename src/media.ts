const BASENAME_PATTERN = /^([a-f0-9]{64})\.([a-z0-9]{2,4})$/;

export const MAX_MEDIA_BYTES = 100 * 1024 * 1024;

// Per-user ceiling across all uploaded media objects.
export const MAX_USER_MEDIA_BYTES = 2 * 1024 * 1024 * 1024;
export const MAX_USER_MEDIA_OBJECTS = 2_000;
export const MAX_STATUS_NAMES = 500;

const CONTENT_TYPES = new Map([
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['heic', 'image/heic'],
  ['webp', 'image/webp'],
  ['mp4', 'video/mp4'],
  ['mov', 'video/quicktime'],
  ['m4v', 'video/x-m4v'],
]);

export type ParsedBasename = {
  sha256: string;
  contentType: string;
};

export function parseBasename(basename: string): ParsedBasename | null {
  const match = BASENAME_PATTERN.exec(basename);
  if (!match) {
    return null;
  }

  const contentType = CONTENT_TYPES.get(match[2]);
  if (!contentType) {
    return null;
  }

  return { sha256: match[1], contentType };
}

export function isMediaBasename(value: string): boolean {
  return parseBasename(value) !== null;
}

export function mediaKey(userId: string, basename: string): string {
  return `${userId}/${basename}`;
}
