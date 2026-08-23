import { META_SCHEMA_VERSION } from '../constants';
import { canonicalizeUrl } from '../data/bookmarks';
import { db } from '../data/database';
import type { BookmarkMeta, BookmarkViewModel, CoverAsset, CoverSource } from '../types/bookmark';
import { processImageBlob, processScreenshot } from './image';

export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim().slice(0, 64)).filter(Boolean))].slice(0, 50);
}

export async function saveBookmarkTags(
  bookmark: BookmarkViewModel,
  tags: string[],
): Promise<void> {
  const existing = await db.metas.get(bookmark.id);
  await db.metas.put(createMeta(bookmark, existing, { tags: normalizeTags(tags) }));
}

export async function addBookmarkTags(
  bookmarks: BookmarkViewModel[],
  tags: string[],
): Promise<void> {
  const incoming = normalizeTags(tags);
  await db.transaction('rw', db.metas, async () => {
    for (const bookmark of bookmarks) {
      const existing = await db.metas.get(bookmark.id);
      await db.metas.put(createMeta(bookmark, existing, {
        tags: normalizeTags([...(existing?.tags ?? []), ...incoming]),
      }));
    }
  });
}

export async function recordBookmarkOpened(bookmark: BookmarkViewModel): Promise<void> {
  const existing = await db.metas.get(bookmark.id);
  await db.metas.put(createMeta(bookmark, existing, { lastOpenedAt: Date.now() }));
}

export async function saveBookmarkCover(
  bookmark: BookmarkViewModel,
  dataUrl: string,
  source: Exclude<CoverSource, 'none'>,
): Promise<void> {
  const processed = await processScreenshot(dataUrl);
  const now = Date.now();
  const asset: CoverAsset = {
    id: crypto.randomUUID(),
    bookmarkId: bookmark.id,
    mimeType: 'image/webp',
    width: processed.width,
    height: processed.height,
    byteSize: processed.blob.size,
    blob: processed.blob,
    createdAt: now,
  };
  await db.transaction('rw', db.metas, db.covers, async () => {
    const existing = await db.metas.get(bookmark.id);
    if (existing?.coverAssetId) await db.covers.delete(existing.coverAssetId);
    await db.covers.put(asset);
    await db.metas.put(createMeta(bookmark, existing, {
      coverAssetId: asset.id,
      coverSource: source,
      capturedAt: now,
    }));
  });
}

export async function saveRemoteBookmarkPreview(
  bookmark: BookmarkViewModel,
  imageBlob: Blob,
  metadata: { description?: string; siteName?: string },
  source: Extract<CoverSource, 'og' | 'generated'> = 'og',
): Promise<void> {
  const processed = await processImageBlob(imageBlob);
  const now = Date.now();
  const asset: CoverAsset = {
    id: crypto.randomUUID(),
    bookmarkId: bookmark.id,
    mimeType: 'image/webp',
    width: processed.width,
    height: processed.height,
    byteSize: processed.blob.size,
    blob: processed.blob,
    createdAt: now,
  };
  const changes: Partial<BookmarkMeta> = {
    coverAssetId: asset.id,
    coverSource: source,
    capturedAt: now,
  };
  if (metadata.description) changes.description = metadata.description.slice(0, 2000);
  if (metadata.siteName) changes.siteName = metadata.siteName.slice(0, 200);

  await db.transaction('rw', db.metas, db.covers, async () => {
    const existing = await db.metas.get(bookmark.id);
    if (existing?.coverAssetId) await db.covers.delete(existing.coverAssetId);
    await db.covers.put(asset);
    await db.metas.put(createMeta(bookmark, existing, changes));
  });
}

export async function removeBookmarkCover(bookmark: BookmarkViewModel): Promise<void> {
  await db.transaction('rw', db.metas, db.covers, async () => {
    const existing = await db.metas.get(bookmark.id);
    await db.covers.where('bookmarkId').equals(bookmark.id).delete();
    if (!existing) return;
    const next = createMeta(bookmark, existing, { coverSource: 'none' });
    delete next.coverAssetId;
    delete next.capturedAt;
    await db.metas.put(next);
  });
}

function createMeta(
  bookmark: BookmarkViewModel,
  existing?: BookmarkMeta,
  changes: Partial<BookmarkMeta> = {},
): BookmarkMeta {
  const url = bookmark.url ?? '';
  let domain = existing?.domain ?? '';
  try {
    domain = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    // Retain the previous value for unusual bookmark URLs.
  }
  return {
    bookmarkId: bookmark.id,
    canonicalUrl: canonicalizeUrl(url),
    domain,
    tags: existing?.tags ?? [],
    coverSource: existing?.coverSource ?? 'none',
    schemaVersion: META_SCHEMA_VERSION,
    ...existing,
    ...changes,
  };
}
