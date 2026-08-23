import Dexie, { type EntityTable } from 'dexie';

import type { BookmarkMeta, CoverAsset } from '../types/bookmark';

interface MigrationRecord {
  id: string;
  completedAt: number;
}

class VisualBookmarkDatabase extends Dexie {
  metas!: EntityTable<BookmarkMeta, 'bookmarkId'>;
  covers!: EntityTable<CoverAsset, 'id'>;
  migrations!: EntityTable<MigrationRecord, 'id'>;

  constructor() {
    super('visual-bookmark');
    this.version(1).stores({
      metas: '&bookmarkId, canonicalUrl, domain, capturedAt, lastOpenedAt, *tags',
      covers: '&id, bookmarkId, createdAt',
      migrations: '&id, completedAt',
    });
  }
}

export const db = new VisualBookmarkDatabase();

export async function upsertBookmarkMeta(meta: BookmarkMeta): Promise<void> {
  await db.metas.put(meta);
}

export async function saveCoverAsset(asset: CoverAsset): Promise<void> {
  await db.transaction('rw', db.covers, db.metas, async () => {
    const previous = await db.metas.get(asset.bookmarkId);
    if (previous?.coverAssetId && previous.coverAssetId !== asset.id) {
      await db.covers.delete(previous.coverAssetId);
    }
    await db.covers.put(asset);
    if (previous) {
      await db.metas.update(asset.bookmarkId, {
        coverAssetId: asset.id,
        capturedAt: asset.createdAt,
      });
    }
  });
}

export async function removeBookmarkEnhancements(bookmarkId: string): Promise<void> {
  await db.transaction('rw', db.metas, db.covers, async () => {
    const meta = await db.metas.get(bookmarkId);
    if (meta?.coverAssetId) await db.covers.delete(meta.coverAssetId);
    await db.covers.where('bookmarkId').equals(bookmarkId).delete();
    await db.metas.delete(bookmarkId);
  });
}

export async function clearAllCovers(): Promise<void> {
  await db.transaction('rw', db.metas, db.covers, async () => {
    await db.covers.clear();
    await db.metas.toCollection().modify((meta) => {
      delete meta.coverAssetId;
      meta.coverSource = 'none';
      delete meta.capturedAt;
    });
  });
}

export async function clearAllEnhancements(): Promise<void> {
  await db.transaction('rw', db.metas, db.covers, async () => {
    await Promise.all([db.covers.clear(), db.metas.clear()]);
  });
}

export async function cleanupOrphans(validBookmarkIds: Set<string>): Promise<number> {
  const metas = await db.metas.toArray();
  const orphanIds = metas
    .filter((meta) => !validBookmarkIds.has(meta.bookmarkId))
    .map((meta) => meta.bookmarkId);
  await Promise.all(orphanIds.map(removeBookmarkEnhancements));
  return orphanIds.length;
}

export async function getStorageStats(): Promise<{
  coverCount: number;
  coverBytes: number;
  metaCount: number;
}> {
  const [covers, metaCount] = await Promise.all([
    db.covers.toArray(),
    db.metas.count(),
  ]);
  return {
    coverCount: covers.length,
    coverBytes: covers.reduce((total, cover) => total + cover.byteSize, 0),
    metaCount,
  };
}
