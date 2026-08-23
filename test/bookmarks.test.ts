import { canonicalizeUrl, findDuplicateBookmarks, flattenBookmarks, sortBookmarks } from '../src/data/bookmarks';
import type { BookmarkViewModel } from '../src/types/bookmark';

const folder: BookmarkViewModel = {
  id: 'folder',
  title: '设计资源',
  folderPath: [],
  isFolder: true,
  isManaged: false,
  children: [
    {
      id: 'a',
      parentId: 'folder',
      title: 'Alpha',
      url: 'https://example.com/a',
      folderPath: ['设计资源'],
      isFolder: false,
      isManaged: false,
      dateAdded: 10,
    },
    {
      id: 'b',
      parentId: 'folder',
      title: 'Beta',
      url: 'https://example.com/b',
      folderPath: ['设计资源'],
      isFolder: false,
      isManaged: false,
      dateAdded: 20,
      meta: {
        bookmarkId: 'b',
        canonicalUrl: 'https://example.com/b',
        domain: 'example.com',
        tags: [],
        coverSource: 'none',
        lastOpenedAt: 100,
        schemaVersion: 1,
      },
    },
  ],
};

describe('bookmark helpers', () => {
  it('flattens nested bookmark trees in stable pre-order', () => {
    expect(flattenBookmarks([folder]).map((item) => item.id)).toEqual(['folder', 'a', 'b']);
  });

  it('sorts newest bookmarks first', () => {
    const children = folder.children ?? [];
    expect(sortBookmarks(children, 'created-desc').map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('sorts by local last-opened metadata', () => {
    const children = folder.children ?? [];
    expect(sortBookmarks(children, 'recently-opened')[0]?.id).toBe('b');
  });

  it('canonicalizes URLs by removing fragments and preserving queries', () => {
    expect(canonicalizeUrl('https://example.com/page?q=1#section')).toBe('https://example.com/page?q=1');
  });

  it('finds duplicate URLs across the complete tree while ignoring fragments', async () => {
    const tree: chrome.bookmarks.BookmarkTreeNode[] = [{
      id: '0',
      title: '',
      syncing: false,
      children: [{
        id: 'folder',
        parentId: '0',
        title: 'Folder',
        syncing: false,
        children: [
          { id: 'match', parentId: 'folder', title: 'Match', url: 'https://example.com/page?q=1#old', syncing: false },
          { id: 'other', parentId: 'folder', title: 'Other', url: 'https://example.com/other', syncing: false },
        ],
      }],
    }];
    (chrome.bookmarks.getTree as unknown as { mockResolvedValueOnce: (value: chrome.bookmarks.BookmarkTreeNode[]) => void })
      .mockResolvedValueOnce(tree);
    const matches = await findDuplicateBookmarks('https://example.com/page?q=1#new');
    expect(matches.map((item) => item.id)).toEqual(['match']);
  });
});
