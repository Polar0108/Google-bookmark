import { removeBookmarkEnhancements } from '../src/data/database';
import type { PageMetadata } from '../src/types/bookmark';
import { isRuntimeMessage } from '../src/types/messages';
import { getNavigationSafety } from '../src/utils/url';

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener((details) => {
    void chrome.sidePanel.setOptions({ path: 'sidepanel.html', enabled: true });
    if (details.reason === 'install') void chrome.runtime.openOptionsPage();
  });

  chrome.action.onClicked.addListener((tab) => {
    if (!tab.id || tab.windowId === undefined) return;
    void chrome.sidePanel.open({ windowId: tab.windowId });
  });

  chrome.bookmarks.onCreated.addListener(broadcastBookmarksChanged);
  chrome.bookmarks.onChanged.addListener(broadcastBookmarksChanged);
  chrome.bookmarks.onMoved.addListener(broadcastBookmarksChanged);
  chrome.bookmarks.onChildrenReordered.addListener(broadcastBookmarksChanged);
  chrome.bookmarks.onImportEnded.addListener(broadcastBookmarksChanged);
  chrome.bookmarks.onRemoved.addListener((id) => {
    void removeBookmarkEnhancements(id);
    broadcastBookmarksChanged();
  });

  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isRuntimeMessage(message)) return false;
    if (message.type === 'CAPTURE_CURRENT_TAB') {
      void captureCurrentTab().then(sendResponse, (error: unknown) => {
        sendResponse({ error: error instanceof Error ? error.message : 'Capture failed.' });
      });
      return true;
    }
    if (message.type === 'OPEN_BOOKMARK') {
      void openBookmark(message.url, message.newTab).then(
        () => sendResponse({ ok: true }),
        (error: unknown) => sendResponse({ error: error instanceof Error ? error.message : 'Open failed.' }),
      );
      return true;
    }
    return false;
  });
});

function broadcastBookmarksChanged(): void {
  void chrome.runtime.sendMessage({ type: 'BOOKMARKS_CHANGED' }).catch(() => undefined);
}

async function openBookmark(url: string, newTab: boolean): Promise<void> {
  if (getNavigationSafety(url) === 'blocked') throw new Error('Blocked unsafe bookmark URL.');
  if (newTab) {
    await chrome.tabs.create({ url, active: false });
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) await chrome.tabs.update(tab.id, { url });
  else await chrome.tabs.create({ url });
}

async function captureCurrentTab(): Promise<{
  metadata: PageMetadata;
  screenshotDataUrl?: string;
  tabId: number;
  windowId: number;
}> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || tab.windowId === undefined || !tab.url) {
    throw new Error('无法读取当前标签页，请再次点击工具栏中的 Visual Bookmark 图标。');
  }
  const metadata = await extractMetadata(tab.id, tab.title || tab.url, tab.url);
  let screenshotDataUrl: string | undefined;
  try {
    screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png',
    });
  } catch {
    if (/^https?:/.test(tab.url)) {
      throw new Error('无法截取当前页面，请确认已允许扩展访问该网站。');
    }
    // Chrome internal pages can still be saved as text-only bookmarks.
  }
  const result: {
    metadata: PageMetadata;
    screenshotDataUrl?: string;
    tabId: number;
    windowId: number;
  } = { metadata, tabId: tab.id, windowId: tab.windowId };
  if (screenshotDataUrl !== undefined) result.screenshotDataUrl = screenshotDataUrl;
  return result;
}

async function extractMetadata(
  tabId: number,
  fallbackTitle: string,
  fallbackUrl: string,
): Promise<PageMetadata> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const getMeta = (selector: string): string | undefined =>
          document.querySelector<HTMLMetaElement>(selector)?.content || undefined;
        return {
          title: document.title,
          url: location.href,
          description:
            getMeta('meta[name="description"]') ||
            getMeta('meta[property="og:description"]'),
          siteName: getMeta('meta[property="og:site_name"]'),
          imageUrl: getMeta('meta[property="og:image"]'),
        };
      },
    });
    return (result?.result as PageMetadata | undefined) ?? {
      title: fallbackTitle,
      url: fallbackUrl,
    };
  } catch {
    return { title: fallbackTitle, url: fallbackUrl };
  }
}
