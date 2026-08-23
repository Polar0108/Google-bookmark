import type { Mock } from 'vitest';

import { captureCurrentTab, requestCaptureAccess } from '../src/services/capture';

describe('capture access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies the required website access before capturing', async () => {
    const contains = chrome.permissions.contains as unknown as Mock;
    contains.mockResolvedValueOnce(true);

    await expect(requestCaptureAccess()).resolves.toBe(true);
    expect(contains).toHaveBeenCalledWith({
      origins: ['<all_urls>'],
    });
  });

  it('captures the active tab directly without sending a large runtime message', async () => {
    const query = chrome.tabs.query as unknown as Mock;
    const executeScript = chrome.scripting.executeScript as unknown as Mock;
    const captureVisibleTab = chrome.tabs.captureVisibleTab as unknown as Mock;
    query.mockResolvedValueOnce([{ id: 12, windowId: 3, title: 'Example', url: 'https://example.com/page' }]);
    executeScript.mockResolvedValueOnce([{
      result: {
        title: 'Example page',
        url: 'https://example.com/page',
        description: 'Example description',
      },
    }]);
    captureVisibleTab.mockResolvedValueOnce('data:image/jpeg;base64,preview');

    await expect(captureCurrentTab()).resolves.toEqual({
      tabId: 12,
      windowId: 3,
      metadata: {
        title: 'Example page',
        url: 'https://example.com/page',
        description: 'Example description',
      },
      screenshotDataUrl: 'data:image/jpeg;base64,preview',
    });
    expect(captureVisibleTab).toHaveBeenCalledWith(3, { format: 'jpeg', quality: 88 });
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('reports the real Chrome capture error instead of silently saving text only', async () => {
    const query = chrome.tabs.query as unknown as Mock;
    const executeScript = chrome.scripting.executeScript as unknown as Mock;
    const captureVisibleTab = chrome.tabs.captureVisibleTab as unknown as Mock;
    query.mockResolvedValueOnce([{ id: 12, windowId: 3, title: 'Example', url: 'https://example.com/' }]);
    executeScript.mockResolvedValueOnce([]);
    captureVisibleTab.mockRejectedValueOnce(new Error('Missing host permission'));

    await expect(captureCurrentTab()).rejects.toThrow('当前页面截图失败：Missing host permission');
  });
});
