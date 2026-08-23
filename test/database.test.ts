import {
  clearAllCovers,
  clearAllEnhancements,
  db,
  getStorageStats,
  removeBookmarkEnhancements,
} from '../src/data/database';
import type { BookmarkMeta, CoverAsset } from '../src/types/bookmark';

const meta: BookmarkMeta = {
  bookmarkId: 'bookmark-db-test',
  canonicalUrl: 'https://example.com/',
  domain: 'example.com',
  tags: ['test'],
  coverAssetId: 'cover-db-test',
  coverSource: 'screenshot',
  capturedAt: 1,
  schemaVersion: 1,
};

const cover: CoverAsset = {
  id: 'cover-db-test',
  bookmarkId: 'bookmark-db-test',
  mimeType: 'image/webp',
  width: 16,
  height: 10,
  byteSize: 3,
  blob: new Blob(['abc'], { type: 'image/webp' }),
  createdAt: 1,
};

describe('visual bookmark database', () => {
  beforeEach(async () => {
    await clearAllEnhancements();
    await db.metas.put(meta);
    await db.covers.put(cover);
  });

  afterAll(async () => {
    await clearAllEnhancements();
    db.close();
  });

  it('reports metadata and cover storage separately', async () => {
    expect(await getStorageStats()).toEqual({ coverCount: 1, coverBytes: 3, metaCount: 1 });
  });

  it('clears covers without deleting tags or native enhancement records', async () => {
    await clearAllCovers();
    expect(await db.covers.count()).toBe(0);
    expect((await db.metas.get(meta.bookmarkId))?.tags).toEqual(['test']);
    expect((await db.metas.get(meta.bookmarkId))?.coverSource).toBe('none');
  });

  it('removes both metadata and cover for a deleted bookmark', async () => {
    await removeBookmarkEnhancements(meta.bookmarkId);
    expect(await getStorageStats()).toEqual({ coverCount: 0, coverBytes: 0, metaCount: 0 });
  });
});
