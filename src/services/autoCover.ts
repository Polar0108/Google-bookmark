import type { BookmarkViewModel } from '../types/bookmark';
import { captureTab, requestCaptureAccess } from './capture';
import { saveBookmarkCover } from './enhancements';
import { updateRemoteBookmarkPreview } from './remotePreview';

const PAGE_READY_TIMEOUT_MS = 15_000;
const FINAL_RENDER_SETTLE_MS = 850;
const pendingCaptures = new Map<number, symbol>();

export function cancelPendingCoverCapture(tabId: number): void {
  pendingCaptures.delete(tabId);
}

export async function autoFillBookmarkCover(
  bookmark: BookmarkViewModel,
  tabId: number,
): Promise<boolean> {
  if (bookmark.meta?.coverAssetId || !bookmark.url) return false;
  const captureToken = Symbol(bookmark.id);
  pendingCaptures.set(tabId, captureToken);

  try {
    await waitForTabReady(tabId);
    if (!isCurrentCapture(tabId, captureToken)) return false;
    await requestCaptureAccess();
    const tab = await chrome.tabs.get(tabId);
    if (!isCurrentCapture(tabId, captureToken) || !tab.active) return false;
    if (!tab.url || !/^https?:/i.test(tab.url)) throw new Error('页面当前不可截图');
    const result = await captureTab(tabId);
    if (!isCurrentCapture(tabId, captureToken)) return false;
    const latestTab = await chrome.tabs.get(tabId);
    if (!latestTab.active || !isCurrentCapture(tabId, captureToken)) return false;
    if (!result.screenshotDataUrl) throw new Error('Chrome 未返回截图');
    await saveBookmarkCover(bookmark, result.screenshotDataUrl, 'screenshot');
    return true;
  } catch {
    if (!isCurrentCapture(tabId, captureToken)) return false;
    const latestTab = await chrome.tabs.get(tabId).catch(() => undefined);
    if (!latestTab?.active || !isCurrentCapture(tabId, captureToken)) return false;
    const fallback = await updateRemoteBookmarkPreview(bookmark);
    return fallback.updated;
  } finally {
    if (isCurrentCapture(tabId, captureToken)) pendingCaptures.delete(tabId);
  }
}

function isCurrentCapture(tabId: number, token: symbol): boolean {
  return pendingCaptures.get(tabId) === token;
}

export async function waitForTabReady(tabId: number, timeoutMs = PAGE_READY_TIMEOUT_MS): Promise<void> {
  const current = await chrome.tabs.get(tabId);
  if (current.status === 'complete') {
    await waitForVisualReady(tabId);
    await settlePage();
    return;
  }

  await new Promise<void>((resolve) => {
    const timer = window.setTimeout(() => finish(), timeoutMs);
    const listener = (updatedId: number, changes: { status?: string }): void => {
      if (updatedId === tabId && changes.status === 'complete') finish();
    };
    const finish = (): void => {
      window.clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
  await waitForVisualReady(tabId);
  await settlePage();
}

function settlePage(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, FINAL_RENDER_SETTLE_MS));
}

async function waitForVisualReady(tabId: number): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: async () => {
        const startedAt = Date.now();
        const minimumWaitMs = 3_500;
        const quietWindowMs = 1_200;
        const maximumWaitMs = 10_000;
        const sleep = (delay: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, delay));

        if (document.readyState !== 'complete') {
          await Promise.race([
            new Promise<void>((resolve) => window.addEventListener('load', () => resolve(), { once: true })),
            sleep(maximumWaitMs),
          ]);
        }

        if ('fonts' in document) {
          await Promise.race([document.fonts.ready.then(() => undefined), sleep(3_000)]);
        }

        let lastMutationAt = Date.now();
        const observer = new MutationObserver(() => { lastMutationAt = Date.now(); });
        observer.observe(document.documentElement, {
          attributes: true,
          childList: true,
          subtree: true,
        });

        try {
          while (Date.now() - startedAt < maximumWaitMs) {
            const elapsed = Date.now() - startedAt;
            const quietFor = Date.now() - lastMutationAt;
            const visibleBusyElement = [...document.querySelectorAll<HTMLElement>(
              '[aria-busy="true"], [class*="skeleton" i], [class*="loading" i]',
            )].some((element) => {
              const rect = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
            });
            if (elapsed >= minimumWaitMs && quietFor >= quietWindowMs && !visibleBusyElement) break;
            await sleep(250);
          }
        } finally {
          observer.disconnect();
        }

        const visibleImages = [...document.images]
          .filter((image) => {
            const rect = image.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= innerHeight;
          })
          .slice(0, 24);
        await Promise.race([
          Promise.all(visibleImages.map((image) => image.decode().catch(() => undefined))),
          sleep(4_000),
        ]);
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      },
    });
  } catch {
    // Restricted pages cannot run scripts; the final local settle still applies.
  }
}
