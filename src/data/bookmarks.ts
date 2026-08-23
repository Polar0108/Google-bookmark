import { cleanupOrphans, db, removeBookmarkEnhancements } from './database';
import type { BookmarkMeta, BookmarkViewModel, SortMode } from '../types/bookmark';

export interface BookmarkCreateInput {
  title: string;
  url: string;
  parentId?: string;
}

export interface BookmarkUpdateInput {
  title?: string;
  url?: string;
}

function toViewModel(
  node: chrome.bookmarks.BookmarkTreeNode,
  folderPath: string[],
  metaMap: Map<string, BookmarkMeta>,
): BookmarkViewModel {
  const isFolder = !node.url;
  const ownPath = isFolder && node.title ? [...folderPath, node.title] : folderPath;
  const model: BookmarkViewModel = {
    id: node.id,
    title: node.title || (isFolder ? '未命名文件夹' : node.url || '未命名书签'),
    folderPath,
    isFolder,
    isManaged: node.unmodifiable === 'managed',
  };

  const meta = metaMap.get(node.id);
  if (meta) model.meta = meta;

  if (node.parentId !== undefined) model.parentId = node.parentId;
  if (node.url !== undefined) model.url = node.url;
  if (node.index !== undefined) model.index = node.index;
  if (node.dateAdded !== undefined) model.dateAdded = node.dateAdded;
  if (node.dateLastUsed !== undefined) model.dateLastUsed = node.dateLastUsed;
  if (node.children) {
    model.children = node.children.map((child) =>
      toViewModel(child, ownPath, metaMap),
    );
  }
  return model;
}

export function flattenBookmarks(nodes: BookmarkViewModel[]): BookmarkViewModel[] {
  const result: BookmarkViewModel[] = [];
  const visit = (node: BookmarkViewModel): void => {
    result.push(node);
    node.children?.forEach(visit);
  };
  nodes.forEach(visit);
  return result;
}

export async function loadBookmarkTree(): Promise<BookmarkViewModel[]> {
  const [tree, metas] = await Promise.all([
    chrome.bookmarks.getTree(),
    db.metas.toArray(),
  ]);
  const metaMap = new Map(metas.map((meta) => [meta.bookmarkId, meta]));
  return tree.map((node) => toViewModel(node, [], metaMap));
}

export async function loadAndCleanupBookmarkTree(): Promise<BookmarkViewModel[]> {
  const tree = await loadBookmarkTree();
  const validIds = new Set(flattenBookmarks(tree).map((bookmark) => bookmark.id));
  await cleanupOrphans(validIds);
  return tree;
}

export async function createBookmark(
  input: BookmarkCreateInput,
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  const details: chrome.bookmarks.CreateDetails = {
    title: input.title,
    url: input.url,
  };
  if (input.parentId !== undefined) details.parentId = input.parentId;
  return chrome.bookmarks.create(details);
}

export async function updateBookmark(
  id: string,
  changes: BookmarkUpdateInput,
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  return chrome.bookmarks.update(id, changes);
}

export async function moveBookmark(
  id: string,
  parentId: string,
  index?: number,
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  const destination: chrome.bookmarks.MoveDestination = { parentId };
  if (index !== undefined) destination.index = index;
  return chrome.bookmarks.move(id, destination);
}

export async function deleteBookmark(
  bookmark: Pick<BookmarkViewModel, 'id' | 'isFolder' | 'isManaged'>,
): Promise<void> {
  if (bookmark.isManaged) throw new Error('Managed bookmarks are read-only.');
  if (bookmark.isFolder) await chrome.bookmarks.removeTree(bookmark.id);
  else await chrome.bookmarks.remove(bookmark.id);
  await removeBookmarkEnhancements(bookmark.id);
}

export async function createFolder(
  title: string,
  parentId?: string,
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  const details: chrome.bookmarks.CreateDetails = { title };
  if (parentId !== undefined) details.parentId = parentId;
  return chrome.bookmarks.create(details);
}

export async function findDuplicateBookmarks(
  url: string,
): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
  const canonical = canonicalizeUrl(url);
  const tree = await chrome.bookmarks.getTree();
  const matches: chrome.bookmarks.BookmarkTreeNode[] = [];
  const visit = (node: chrome.bookmarks.BookmarkTreeNode): void => {
    if (node.url && canonicalizeUrl(node.url) === canonical) matches.push(node);
    node.children?.forEach(visit);
  };
  tree.forEach(visit);
  return matches;
}

export function canonicalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.hash = '';
    return url.toString();
  } catch {
    return rawUrl.split('#')[0] ?? rawUrl;
  }
}

export function sortBookmarks(
  bookmarks: BookmarkViewModel[],
  mode: SortMode,
): BookmarkViewModel[] {
  const copy = [...bookmarks];
  copy.sort((a, b) => {
    if (mode === 'title') return a.title.localeCompare(b.title);
    if (mode === 'created-asc') return (a.dateAdded ?? 0) - (b.dateAdded ?? 0);
    if (mode === 'recently-opened') {
      return (b.meta?.lastOpenedAt ?? b.dateLastUsed ?? 0) -
        (a.meta?.lastOpenedAt ?? a.dateLastUsed ?? 0);
    }
    return (b.dateAdded ?? 0) - (a.dateAdded ?? 0);
  });
  return copy;
}
