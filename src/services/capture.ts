import type { CaptureResult, PageMetadata } from '../types/bookmark';

const CAPTURE_ORIGINS = ['<all_urls>'];

export async function requestCaptureAccess(): Promise<boolean> {
  if (!chrome.permissions?.contains) return true;
  try {
    const granted = await chrome.permissions.contains({ origins: CAPTURE_ORIGINS });
    if (!granted) {
      throw new Error('扩展缺少网页访问权限，请在 chrome://extensions 中重新加载扩展并允许网站访问。');
    }
    return true;
  } catch (reason) {
    if (reason instanceof Error && reason.message.startsWith('扩展缺少')) throw reason;
    const message = reason instanceof Error ? reason.message : '未知权限错误';
    throw new Error(`无法确认网页截图权限：${message}`);
  }
}

export async function captureCurrentTab(): Promise<CaptureResult> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || tab.windowId === undefined || !tab.url) {
    throw new Error('无法读取当前页面，请允许扩展访问该网站后重试。');
  }

  return captureResolvedTab(tab.id, tab);
}

export async function captureTab(tabId: number): Promise<CaptureResult> {
  const tab = await chrome.tabs.get(tabId);
  return captureResolvedTab(tabId, tab);
}

async function captureResolvedTab(tabId: number, tab: chrome.tabs.Tab): Promise<CaptureResult> {
  if (tab.windowId === undefined || !tab.url) {
    throw new Error('无法读取当前页面，请允许扩展访问该网站后重试。');
  }

  const metadataRequest = extractMetadata(tabId, tab.title || tab.url, tab.url);
  const screenshotRequest = chrome.tabs.captureVisibleTab(tab.windowId, {
    format: 'jpeg',
    quality: 88,
  }).catch((reason: unknown) => {
    const message = reason instanceof Error ? reason.message : 'Chrome 未返回截图';
    throw new Error(`当前页面截图失败：${message}`);
  });
  const [metadata, screenshotDataUrl] = await Promise.all([metadataRequest, screenshotRequest]);

  return {
    tabId,
    windowId: tab.windowId,
    metadata,
    screenshotDataUrl,
  };
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
