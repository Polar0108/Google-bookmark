export type RuntimeMessage =
  | { type: 'BOOKMARKS_CHANGED' }
  | { type: 'OPEN_BOOKMARK'; bookmarkId: string; url: string; newTab: boolean }
  | { type: 'CAPTURE_CURRENT_TAB' };

export function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  const message = value as Record<string, unknown>;
  if (message.type === 'BOOKMARKS_CHANGED' || message.type === 'CAPTURE_CURRENT_TAB') return true;
  return message.type === 'OPEN_BOOKMARK' &&
    typeof message.bookmarkId === 'string' &&
    typeof message.url === 'string' &&
    typeof message.newTab === 'boolean';
}
