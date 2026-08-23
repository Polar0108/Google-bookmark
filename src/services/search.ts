import MiniSearch from 'minisearch';

import type { BookmarkViewModel } from '../types/bookmark';

interface SearchDocument {
  id: string;
  title: string;
  url: string;
  domain: string;
  description: string;
  folderPath: string;
  tags: string;
}

export class BookmarkSearchIndex {
  private readonly search = new MiniSearch<SearchDocument>({
    fields: ['title', 'url', 'domain', 'description', 'folderPath', 'tags'],
    storeFields: ['id'],
    searchOptions: {
      boost: { title: 3, tags: 2, domain: 1.5, folderPath: 1.2 },
      fuzzy: 0.2,
      prefix: true,
    },
  });

  private bookmarks = new Map<string, BookmarkViewModel>();

  rebuild(bookmarks: BookmarkViewModel[]): void {
    this.search.removeAll();
    this.bookmarks = new Map(bookmarks.map((bookmark) => [bookmark.id, bookmark]));
    this.search.addAll(bookmarks.map(toSearchDocument));
  }

  query(query: string): BookmarkViewModel[] {
    const trimmed = query.trim();
    if (!trimmed) return [...this.bookmarks.values()];
    return this.search
      .search(trimmed)
      .map((result) => this.bookmarks.get(String(result.id)))
      .filter((bookmark): bookmark is BookmarkViewModel => Boolean(bookmark));
  }
}

function toSearchDocument(bookmark: BookmarkViewModel): SearchDocument {
  let domain = '';
  if (bookmark.url) {
    try {
      domain = new URL(bookmark.url).hostname;
    } catch {
      domain = '';
    }
  }
  return {
    id: bookmark.id,
    title: bookmark.title,
    url: bookmark.url ?? '',
    domain,
    description: bookmark.meta?.description ?? '',
    folderPath: bookmark.folderPath.join(' '),
    tags: bookmark.meta?.tags.join(' ') ?? '',
  };
}

