import { BookmarkSearchIndex } from '../src/services/search';
import type { BookmarkViewModel } from '../src/types/bookmark';

const bookmarks: BookmarkViewModel[] = [
  {
    id: 'design',
    title: 'Editorial card patterns',
    url: 'https://design.example.com/cards',
    folderPath: ['设计资源'],
    isFolder: false,
    isManaged: false,
    meta: {
      bookmarkId: 'design',
      canonicalUrl: 'https://design.example.com/cards',
      domain: 'design.example.com',
      tags: ['灵感'],
      coverSource: 'none',
      schemaVersion: 1,
    },
  },
  {
    id: 'code',
    title: 'Chrome Extension API',
    url: 'https://developer.chrome.com/docs/extensions',
    folderPath: ['技术文章'],
    isFolder: false,
    isManaged: false,
  },
];

describe('BookmarkSearchIndex', () => {
  it('finds bookmarks by title, folder and tag', () => {
    const index = new BookmarkSearchIndex();
    index.rebuild(bookmarks);
    expect(index.query('Editorial')[0]?.id).toBe('design');
    expect(index.query('技术文章')[0]?.id).toBe('code');
    expect(index.query('灵感')[0]?.id).toBe('design');
  });

  it('returns all bookmarks for an empty query', () => {
    const index = new BookmarkSearchIndex();
    index.rebuild(bookmarks);
    expect(index.query('')).toHaveLength(2);
  });

  it('queries a 10,000 bookmark index without a linear DOM-style scan', () => {
    const largeSet = Array.from({ length: 10_000 }, (_, number): BookmarkViewModel => ({
      id: String(number),
      title: number === 9_999 ? 'Unique visual bookmark target' : `Reference ${number}`,
      url: `https://example.com/${number}`,
      folderPath: ['资料'],
      isFolder: false,
      isManaged: false,
    }));
    const index = new BookmarkSearchIndex();
    index.rebuild(largeSet);
    const startedAt = performance.now();
    expect(index.query('Unique visual target')[0]?.id).toBe('9999');
    expect(performance.now() - startedAt).toBeLessThan(250);
  });
});
