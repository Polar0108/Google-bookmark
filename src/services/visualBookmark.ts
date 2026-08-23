import { META_SCHEMA_VERSION } from '../constants';
import { canonicalizeUrl, createBookmark, findDuplicateBookmarks } from '../data/bookmarks';
import { db } from '../data/database';
import type { BookmarkMeta, CaptureResult, CoverAsset } from '../types/bookmark';
import { processScreenshot } from './image';

export interface SaveVisualBookmarkInput {
  capture: CaptureResult;
  title: string;
  parentId?: string;
  tags: string[];
  targetBookmarkId?: string;
}

export async function saveVisualBookmark(
  input: SaveVisualBookmarkInput,
): Promise<{ bookmarkId: string; coverSaved: boolean; updatedExisting: boolean }> {
  const { capture } = input;
  let bookmarkId = input.targetBookmarkId;
  let updatedExisting = Boolean(bookmarkId);

  if (!bookmarkId) {
    const created = await createBookmark({
      title: input.title,
      url: capture.metadata.url,
      ...(input.parentId ? { parentId: input.parentId } : {}),
    });
    bookmarkId = created.id;
    updatedExisting = false;
  } else {
    await chrome.bookmarks.update(bookmarkId, {
      title: input.title,
      url: capture.metadata.url,
    });
  }

  const domain = safeDomain(capture.metadata.url);
  const meta: BookmarkMeta = {
    bookmarkId,
    canonicalUrl: canonicalizeUrl(capture.metadata.url),
    domain,
    tags: input.tags,
    coverSource: capture.screenshotDataUrl ? 'screenshot' : 'none',
    schemaVersion: META_SCHEMA_VERSION,
  };
  if (capture.metadata.siteName) meta.siteName = capture.metadata.siteName;
  if (capture.metadata.description) meta.description = capture.metadata.description;

  let cover: CoverAsset | undefined;
  if (capture.screenshotDataUrl) {
    try {
      const processed = await processScreenshot(capture.screenshotDataUrl);
      const id = crypto.randomUUID();
      cover = {
        id,
        bookmarkId,
        mimeType: 'image/webp',
        width: processed.width,
        height: processed.height,
        byteSize: processed.blob.size,
        blob: processed.blob,
        createdAt: Date.now(),
      };
      meta.coverAssetId = id;
      meta.capturedAt = cover.createdAt;
    } catch {
      meta.coverSource = 'none';
    }
  }

  try {
    await db.transaction('rw', db.metas, db.covers, async () => {
      const previous = await db.metas.get(bookmarkId);
      const nextMeta: BookmarkMeta = {
        ...previous,
        ...meta,
        tags: input.tags.length ? input.tags : previous?.tags ?? [],
      };
      if (previous?.coverAssetId && previous.coverAssetId !== cover?.id) {
        if (cover) await db.covers.delete(previous.coverAssetId);
      }
      if (cover) {
        await db.covers.put(cover);
        nextMeta.coverAssetId = cover.id;
        nextMeta.coverSource = 'screenshot';
        nextMeta.capturedAt = cover.createdAt;
      } else if (previous?.coverAssetId) {
        nextMeta.coverAssetId = previous.coverAssetId;
        nextMeta.coverSource = previous.coverSource;
        if (previous.capturedAt !== undefined) nextMeta.capturedAt = previous.capturedAt;
      }
      await db.metas.put(nextMeta);
    });
    return { bookmarkId, coverSaved: Boolean(cover), updatedExisting };
  } catch {
    // The native bookmark has already been saved. Report the local enhancement
    // failure without losing the user's bookmark operation.
    return { bookmarkId, coverSaved: false, updatedExisting };
  }
}

export async function getDuplicateChoices(url: string): Promise<
  Array<{ id: string; title: string; parentId?: string }>
> {
  const matches = await findDuplicateBookmarks(url);
  return matches.map((match) => {
    const choice: { id: string; title: string; parentId?: string } = {
      id: match.id,
      title: match.title || match.url || '未命名书签',
    };
    if (match.parentId !== undefined) choice.parentId = match.parentId;
    return choice;
  });
}

function safeDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}
