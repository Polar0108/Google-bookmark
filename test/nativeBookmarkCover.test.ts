import type { Mock } from 'vitest';

import { captureNativeBookmarkCover } from '../src/services/nativeBookmarkCover';
import { saveBookmarkCover } from '../src/services/enhancements';

vi.mock('../src/services/enhancements', () => ({
  saveBookmarkCover: vi.fn(),
}));

describe('native bookmark cover capture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('captures and saves the active page when Chrome creates its bookmark', async () => {
    const query = chrome.tabs.query as unknown as Mock;
    const captureVisibleTab = chrome.tabs.captureVisibleTab as unknown as Mock;
    query
      .mockResolvedValueOnce([{ id: 12, windowId: 3, url: 'https://example.com/page#intro' }])
      .mockResolvedValueOnce([{ id: 12, windowId: 3, url: 'https://example.com/page#details' }]);
    captureVisibleTab.mockResolvedValueOnce('data:image/jpeg;base64,preview');

    await expect(captureNativeBookmarkCover('bookmark-1', {
      id: 'bookmark-1',
      parentId: '2',
      title: 'Example',
      url: 'https://example.com/page',
      syncing: false,
    })).resolves.toBe(true);

    expect(captureVisibleTab).toHaveBeenCalledWith(3, { format: 'jpeg', quality: 88 });
    expect(saveBookmarkCover).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'bookmark-1', url: 'https://example.com/page' }),
      'data:image/jpeg;base64,preview',
      'screenshot',
    );
  });

  it('does not capture when the active page is not the bookmarked URL', async () => {
    const query = chrome.tabs.query as unknown as Mock;
    query.mockResolvedValueOnce([{ id: 12, windowId: 3, url: 'https://other.example/' }]);

    await expect(captureNativeBookmarkCover('bookmark-1', {
      id: 'bookmark-1',
      title: 'Example',
      url: 'https://example.com/page',
      syncing: false,
    })).resolves.toBe(false);

    expect(chrome.tabs.captureVisibleTab).not.toHaveBeenCalled();
    expect(saveBookmarkCover).not.toHaveBeenCalled();
  });

  it('discards the screenshot if the user changes tabs during capture', async () => {
    const query = chrome.tabs.query as unknown as Mock;
    const captureVisibleTab = chrome.tabs.captureVisibleTab as unknown as Mock;
    query
      .mockResolvedValueOnce([{ id: 12, windowId: 3, url: 'https://example.com/page' }])
      .mockResolvedValueOnce([{ id: 99, windowId: 3, url: 'https://example.com/page' }]);
    captureVisibleTab.mockResolvedValueOnce('data:image/jpeg;base64,preview');

    await expect(captureNativeBookmarkCover('bookmark-1', {
      id: 'bookmark-1',
      title: 'Example',
      url: 'https://example.com/page',
      syncing: false,
    })).resolves.toBe(false);

    expect(saveBookmarkCover).not.toHaveBeenCalled();
  });
});
