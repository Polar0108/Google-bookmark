import type { BookmarkViewModel } from '../types/bookmark';
import { saveRemoteBookmarkPreview } from './enhancements';
import { createGeneratedCover } from './image';

const PAGE_TIMEOUT_MS = 10_000;
const IMAGE_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export interface RemotePreviewResult {
  updated: boolean;
  reason?: string;
}

export async function updateRemoteBookmarkPreview(
  bookmark: BookmarkViewModel,
): Promise<RemotePreviewResult> {
  if (!bookmark.url || !/^https?:/i.test(bookmark.url)) {
    return { updated: false, reason: '不支持此网址协议' };
  }

  let description: string | undefined;
  let siteName: string | undefined;
  let remoteFailure = '网站没有公开预览图';

  try {
    const pageResponse = await fetchWithTimeout(bookmark.url, PAGE_TIMEOUT_MS);
    if (!pageResponse.ok) throw new Error(`网页返回 ${pageResponse.status}`);
    const htmlLength = Number(pageResponse.headers.get('content-length') || 0);
    if (htmlLength > MAX_HTML_BYTES) throw new Error('网页内容过大');
    const contentType = pageResponse.headers.get('content-type') || '';
    if (contentType && !contentType.includes('text/html')) {
      throw new Error('不是网页内容');
    }

    const html = await pageResponse.text();
    if (new Blob([html]).size > MAX_HTML_BYTES) throw new Error('网页内容过大');
    const documentNode = new DOMParser().parseFromString(html, 'text/html');
    description = firstContent(documentNode, [
      'meta[property="og:description"]',
      'meta[name="description"]',
      'meta[name="twitter:description"]',
    ]);
    siteName = firstContent(documentNode, [
      'meta[property="og:site_name"]',
      'meta[name="application-name"]',
    ]);
    const imageReference = firstContent(documentNode, [
      'meta[property="og:image:secure_url"]',
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      'meta[name="twitter:image:src"]',
      'link[rel="image_src"]',
    ]);
    if (imageReference) {
      const imageUrl = new URL(imageReference, pageResponse.url || bookmark.url);
      if (!['http:', 'https:'].includes(imageUrl.protocol)) throw new Error('预览图网址不受支持');
      const imageResponse = await fetchWithTimeout(imageUrl.toString(), IMAGE_TIMEOUT_MS);
      if (!imageResponse.ok) throw new Error(`图片返回 ${imageResponse.status}`);
      const imageLength = Number(imageResponse.headers.get('content-length') || 0);
      if (imageLength > MAX_IMAGE_BYTES) throw new Error('预览图过大');
      const imageBlob = await imageResponse.blob();
      if (imageBlob.type && !imageBlob.type.startsWith('image/')) throw new Error('预览资源不是图片');
      if (imageBlob.size > MAX_IMAGE_BYTES) throw new Error('预览图过大');
      await saveRemoteBookmarkPreview(bookmark, imageBlob, compactMetadata(description, siteName));
      return { updated: true };
    }
  } catch (reason) {
    remoteFailure = reason instanceof Error ? reason.message : '读取失败';
  }

  try {
    const generatedCover = await createGeneratedCover(bookmark.url, bookmark.title);
    await saveRemoteBookmarkPreview(
      bookmark,
      generatedCover,
      compactMetadata(description, siteName),
      'generated',
    );
    return { updated: true, reason: remoteFailure };
  } catch (reason) {
    return { updated: false, reason: reason instanceof Error ? reason.message : remoteFailure };
  }
}

function compactMetadata(description?: string, siteName?: string): { description?: string; siteName?: string } {
  return {
    ...(description ? { description } : {}),
    ...(siteName ? { siteName } : {}),
  };
}

function firstContent(documentNode: Document, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const element = documentNode.querySelector<HTMLMetaElement | HTMLLinkElement>(selector);
    const value = element instanceof HTMLMetaElement ? element.content : element?.getAttribute('href');
    if (value?.trim()) return value.trim();
  }
  return undefined;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      cache: 'no-cache',
      credentials: 'omit',
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
}
