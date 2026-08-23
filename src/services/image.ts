import {
  COVER_ASPECT_RATIO,
  COVER_MAX_WIDTH,
  COVER_WEBP_QUALITY,
} from '../constants';

export interface ProcessedCover {
  blob: Blob;
  width: number;
  height: number;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function calculateCenterCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetRatio = COVER_ASPECT_RATIO,
): CropRect {
  const sourceRatio = sourceWidth / sourceHeight;
  if (sourceRatio > targetRatio) {
    const width = sourceHeight * targetRatio;
    return { x: (sourceWidth - width) / 2, y: 0, width, height: sourceHeight };
  }
  const height = sourceWidth / targetRatio;
  return { x: 0, y: (sourceHeight - height) / 2, width: sourceWidth, height };
}

export async function processScreenshot(dataUrl: string): Promise<ProcessedCover> {
  const response = await fetch(dataUrl);
  const sourceBlob = await response.blob();
  return processImageBlob(sourceBlob);
}

export async function processImageBlob(sourceBlob: Blob): Promise<ProcessedCover> {
  const image = await createImageBitmap(sourceBlob);
  const crop = calculateCenterCrop(image.width, image.height);
  const width = Math.min(COVER_MAX_WIDTH, Math.round(crop.width));
  const height = Math.round(width / COVER_ASPECT_RATIO);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas is unavailable.');
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    width,
    height,
  );
  image.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Image encoding failed.'))),
      'image/webp',
      COVER_WEBP_QUALITY,
    );
  });
  return { blob, width, height };
}

export function getFaviconUrl(pageUrl: string, size = 32): string {
  const faviconUrl = new URL(chrome.runtime.getURL('/_favicon/'));
  faviconUrl.searchParams.set('pageUrl', pageUrl);
  faviconUrl.searchParams.set('size', String(size));
  return faviconUrl.toString();
}

export async function createGeneratedCover(pageUrl: string, title: string): Promise<Blob> {
  const width = COVER_MAX_WIDTH;
  const height = Math.round(width / COVER_ASPECT_RATIO);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas is unavailable.');

  const domain = safeDomain(pageUrl);
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#303134');
  gradient.addColorStop(1, '#202124');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.fillStyle = '#3c4043';
  roundRect(context, width / 2 - 100, height / 2 - 138, 200, 200, 44);
  context.fill();

  let drewFavicon = false;
  try {
    const response = await fetch(getFaviconUrl(pageUrl, 128));
    if (response.ok) {
      const image = await createImageBitmap(await response.blob());
      const iconSize = Math.min(116, image.width, image.height);
      context.drawImage(image, width / 2 - iconSize / 2, height / 2 - 96, iconSize, iconSize);
      image.close();
      drewFavicon = true;
    }
  } catch {
    // A letter mark below still produces a useful, stable cover.
  }

  if (!drewFavicon) {
    context.fillStyle = '#e8eaed';
    context.font = '700 78px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText((domain || title || '?').slice(0, 1).toUpperCase(), width / 2, height / 2 - 38);
  }

  context.fillStyle = '#e8eaed';
  context.font = '600 34px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  context.fillText(trimCanvasText(context, title || domain || 'Bookmark', width - 120), width / 2, height - 88);
  context.fillStyle = '#9aa0a6';
  context.font = '400 23px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
  context.fillText(trimCanvasText(context, domain, width - 160), width / 2, height - 48);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Image encoding failed.'))),
      'image/webp',
      COVER_WEBP_QUALITY,
    );
  });
}

function safeDomain(pageUrl: string): string {
  try {
    return new URL(pageUrl).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function trimCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (context.measureText(text).width <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && context.measureText(`${value}…`).width > maxWidth) value = value.slice(0, -1);
  return `${value}…`;
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}
