import type { Mock } from 'vitest';

import { autoFillBookmarkCover } from '../src/services/autoCover';
import { captureTab, requestCaptureAccess } from '../src/services/capture';
import { saveBookmarkCover } from '../src/services/enhancements';
import { updateRemoteBookmarkPreview } from '../src/services/remotePreview';
import type { BookmarkViewModel } from '../src/types/bookmark';

vi.mock('../src/services/capture', () => ({
  captureTab: vi.fn(),
  requestCaptureAccess: vi.fn(),
}));
vi.mock('../src/services/enhancements', () => ({ saveBookmarkCover: vi.fn() }));
vi.mock('../src/services/remotePreview', () => ({ updateRemoteBookmarkPreview: vi.fn() }));

const bookmark: BookmarkViewModel = {
  id: 'auto-cover',
  title: 'Auto cover',
  url: 'https://example.com',
  folderPath: [],
  isFolder: false,
  isManaged: false,
};

describe('automatic cover completion', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    (chrome.tabs.get as unknown as Mock).mockResolvedValue({
      id: 9,
      active: true,
      status: 'complete',
      url: bookmark.url,
    } as chrome.tabs.Tab);
    vi.mocked(requestCaptureAccess).mockResolvedValue(true);
    vi.mocked(captureTab).mockResolvedValue({
      tabId: 9,
      windowId: 1,
      metadata: { title: bookmark.title, url: bookmark.url! },
      screenshotDataUrl: 'data:image/jpeg;base64,cover',
    });
  });

  afterEach(() => vi.useRealTimers());

  it('captures and stores the loaded tab after opening a bookmark', async () => {
    const result = autoFillBookmarkCover(bookmark, 9);
    await vi.advanceTimersByTimeAsync(850);
    await expect(result).resolves.toBe(true);
    expect(captureTab).toHaveBeenCalledWith(9);
    expect(saveBookmarkCover).toHaveBeenCalledWith(bookmark, 'data:image/jpeg;base64,cover', 'screenshot');
  });

  it('does not replace an existing cover when the bookmark is opened', async () => {
    const bookmarkWithCover: BookmarkViewModel = {
      ...bookmark,
      meta: {
        bookmarkId: bookmark.id,
        canonicalUrl: bookmark.url!,
        domain: 'example.com',
        tags: [],
        coverAssetId: 'old-cover',
        coverSource: 'screenshot',
        schemaVersion: 1,
      },
    };
    await expect(autoFillBookmarkCover(bookmarkWithCover, 9)).resolves.toBe(false);
    expect(captureTab).not.toHaveBeenCalled();
    expect(saveBookmarkCover).not.toHaveBeenCalled();
  });

  it('cancels the older capture when two bookmarks reuse the same tab', async () => {
    const nextBookmark: BookmarkViewModel = {
      ...bookmark,
      id: 'second-bookmark',
      title: 'Second page',
      url: 'https://second.example.com',
    };
    const firstResult = autoFillBookmarkCover(bookmark, 9);
    await Promise.resolve();
    const secondResult = autoFillBookmarkCover(nextBookmark, 9);
    await vi.advanceTimersByTimeAsync(850);

    await expect(firstResult).resolves.toBe(false);
    await expect(secondResult).resolves.toBe(true);
    expect(captureTab).toHaveBeenCalledTimes(1);
    expect(saveBookmarkCover).toHaveBeenCalledTimes(1);
    expect(saveBookmarkCover).toHaveBeenCalledWith(
      nextBookmark,
      'data:image/jpeg;base64,cover',
      'screenshot',
    );
  });

  it('falls back to remote cover completion when screenshot capture fails', async () => {
    vi.mocked(captureTab).mockRejectedValue(new Error('capture failed'));
    vi.mocked(updateRemoteBookmarkPreview).mockResolvedValue({ updated: true });
    const result = autoFillBookmarkCover(bookmark, 9);
    await vi.advanceTimersByTimeAsync(850);
    await expect(result).resolves.toBe(true);
    expect(updateRemoteBookmarkPreview).toHaveBeenCalledWith(bookmark);
  });
});
