import type { Mock } from 'vitest';

import { saveRemoteBookmarkPreview } from '../src/services/enhancements';
import { createGeneratedCover } from '../src/services/image';
import { updateRemoteBookmarkPreview } from '../src/services/remotePreview';
import type { BookmarkViewModel } from '../src/types/bookmark';

vi.mock('../src/services/enhancements', () => ({
  saveRemoteBookmarkPreview: vi.fn(),
}));

vi.mock('../src/services/image', () => ({
  createGeneratedCover: vi.fn(),
}));

const bookmark: BookmarkViewModel = {
  id: 'remote-preview',
  title: 'Remote preview',
  url: 'https://example.com/article',
  folderPath: [],
  isFolder: false,
  isManaged: false,
};

describe('remote bookmark previews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createGeneratedCover).mockResolvedValue(new Blob(['generated'], { type: 'image/webp' }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads an Open Graph image and stores it as the bookmark cover', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(`
        <html><head>
          <meta property="og:image" content="/cover.jpg">
          <meta property="og:description" content="Saved page description">
          <meta property="og:site_name" content="Example Site">
        </head></html>
      `, { status: 200, headers: { 'content-type': 'text/html' } }))
      .mockResolvedValueOnce(new Response(new Blob(['image'], { type: 'image/jpeg' }), {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(updateRemoteBookmarkPreview(bookmark)).resolves.toEqual({ updated: true });
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://example.com/cover.jpg', expect.any(Object));
    expect(saveRemoteBookmarkPreview as unknown as Mock).toHaveBeenCalledWith(
      bookmark,
      expect.any(Blob),
      { description: 'Saved page description', siteName: 'Example Site' },
    );
  });

  it('creates a stable local cover when a site has no public preview image', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(
      '<html><head><title>No image</title></head></html>',
      { status: 200, headers: { 'content-type': 'text/html' } },
    )));

    await expect(updateRemoteBookmarkPreview(bookmark)).resolves.toEqual({
      updated: true,
      reason: '网站没有公开预览图',
    });
    expect(createGeneratedCover).toHaveBeenCalledWith(bookmark.url, bookmark.title);
    expect(saveRemoteBookmarkPreview).toHaveBeenCalledWith(
      bookmark,
      expect.any(Blob),
      {},
      'generated',
    );
  });
});
