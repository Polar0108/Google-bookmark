import { isRuntimeMessage } from '../src/types/messages';

describe('isRuntimeMessage', () => {
  it('accepts typed message-shaped values', () => {
    expect(isRuntimeMessage({ type: 'BOOKMARKS_CHANGED' })).toBe(true);
  });

  it('rejects null and values without a string type', () => {
    expect(isRuntimeMessage(null)).toBe(false);
    expect(isRuntimeMessage({ type: 1 })).toBe(false);
    expect(isRuntimeMessage({ type: 'OPEN_BOOKMARK', url: 'https://example.com' })).toBe(false);
    expect(isRuntimeMessage({ type: 'UNKNOWN' })).toBe(false);
  });
});
