import { mediaKey } from '../../media';
import type { SyncRepo } from '../../repo';
import { mediaBasenameOf } from '../../tables';
import type { SanitizedRow } from '../../tables';

export async function collectOrphanedMedia(
  repo: SyncRepo,
  bucket: R2Bucket,
  keyHash: string,
  rows: SanitizedRow[],
): Promise<void> {
  const softDeleted = [
    ...new Set(
      rows
        .filter(row => row.deletedAt !== null)
        .map(mediaBasenameOf)
        .filter((value): value is string => value !== null),
    ),
  ];

  if (softDeleted.length === 0) {
    return;
  }

  const userId = await repo.getUserId(keyHash);
  if (!userId) {
    return;
  }

  const orphaned = await repo.listOrphanedMediaBasenames(userId, softDeleted);
  if (orphaned.length === 0) {
    return;
  }
  await repo.deleteMediaObjects(userId, orphaned);
  await Promise.allSettled(
    orphaned.map(basename => bucket.delete(mediaKey(userId, basename))),
  );
}
