import { canonicalizeUrl } from '../data/bookmarks';
import type { BookmarkViewModel } from '../types/bookmark';
import { saveBookmarkCover } from './enhancements';

export async function captureNativeBookmarkCover(
  bookmarkId: string,
  node: chrome.bookmarks.BookmarkTreeNode,
): Promise<boolean> {
  if (!node.url || !/^https?:/i.test(node.url)) return false;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined || tab.windowId === undefined || !tab.url) return false;
  if (canonicalizeUrl(tab.url) !== canonicalizeUrl(node.url)) return false;

  const screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: 'jpeg',
    quality: 88,
  });

  // captureVisibleTab always captures whichever tab is active at that instant.
  // Re-check after capture so a fast tab switch can never attach the wrong site.
  const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (
    currentTab?.id !== tab.id ||
    !currentTab.url ||
    canonicalizeUrl(currentTab.url) !== canonicalizeUrl(node.url)
  ) {
    return false;
  }

  const bookmark: BookmarkViewModel = {
    id: bookmarkId,
    title: node.title || node.url,
    url: node.url,
    folderPath: [],
    isFolder: false,
    isManaged: node.unmodifiable === 'managed',
  };
  if (node.parentId !== undefined) bookmark.parentId = node.parentId;
  if (node.index !== undefined) bookmark.index = node.index;
  if (node.dateAdded !== undefined) bookmark.dateAdded = node.dateAdded;

  await saveBookmarkCover(bookmark, screenshotDataUrl, 'screenshot');
  return true;
}
