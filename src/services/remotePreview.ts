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

export interface ExtractedPreviewMetadata {
  imageReference?: string;
  description?: string;
  siteName?: string;
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
    const extracted = extractPreviewMetadata(html);
    description = extracted.description;
    siteName = extracted.siteName;
    const imageReference = extracted.imageReference;
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

export function extractPreviewMetadata(html: string): ExtractedPreviewMetadata {
  const headMatch = /<head\b[^>]*>([\s\S]*?)<\/head\s*>/i.exec(html);
  const searchableHtml = (headMatch?.[1] ?? html.slice(0, 512 * 1024))
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  const metaValues = new Map<string, string>();
  let imageSource: string | undefined;

  for (const match of searchableHtml.matchAll(/<(meta|link)\b[^>]*>/gi)) {
    const tagName = match[1]?.toLowerCase();
    const attributes = parseAttributes(match[0]);
    if (tagName === 'meta') {
      const key = (attributes.property || attributes.name)?.toLowerCase();
      const content = attributes.content?.trim();
      if (key && content && !metaValues.has(key)) metaValues.set(key, content);
      continue;
    }
    const relTokens = attributes.rel?.toLowerCase().split(/\s+/) ?? [];
    if (!imageSource && relTokens.includes('image_src') && attributes.href?.trim()) {
      imageSource = attributes.href.trim();
    }
  }

  const imageReference = firstDefined(
    metaValues.get('og:image:secure_url'),
    metaValues.get('og:image'),
    metaValues.get('twitter:image'),
    metaValues.get('twitter:image:src'),
    imageSource,
  );
  const description = firstDefined(
    metaValues.get('og:description'),
    metaValues.get('description'),
    metaValues.get('twitter:description'),
  );
  const siteName = firstDefined(
    metaValues.get('og:site_name'),
    metaValues.get('application-name'),
  );
  return {
    ...(imageReference ? { imageReference } : {}),
    ...(description ? { description } : {}),
    ...(siteName ? { siteName } : {}),
  };
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attributePattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of tag.matchAll(attributePattern)) {
    const name = match[1]?.toLowerCase();
    if (!name || name === 'meta' || name === 'link') continue;
    const rawValue = match[2] ?? match[3] ?? match[4] ?? '';
    attributes[name] = decodeHtmlEntities(rawValue);
  }
  return attributes;
}

function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: '&', apos: "'", gt: '>', lt: '<', quot: '"',
  };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|apos|gt|lt|quot);/gi, (entity, code: string) => {
    if (code[0] !== '#') return namedEntities[code.toLowerCase()] ?? entity;
    const isHex = code[1]?.toLowerCase() === 'x';
    const valueStart = isHex ? 2 : 1;
    const codePoint = Number.parseInt(code.slice(valueStart), isHex ? 16 : 10);
    try {
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    } catch {
      return entity;
    }
  });
}

function firstDefined(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => Boolean(value?.trim()))?.trim();
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
