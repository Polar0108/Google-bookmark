import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { vi } from 'vitest';

class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

Object.defineProperty(globalThis, 'chrome', {
  configurable: true,
  value: ({
    runtime: {
      getURL: (path: string) => `chrome-extension://test${path}`,
      lastError: undefined,
      sendMessage: vi.fn(),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    storage: {
      sync: { get: vi.fn(), set: vi.fn() },
      session: { get: vi.fn(), set: vi.fn() },
    },
    permissions: {
      request: vi.fn(),
      contains: vi.fn(),
    },
    sidePanel: {
      setPanelBehavior: vi.fn(),
    },
    bookmarks: {
      getTree: vi.fn(),
      search: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      move: vi.fn(),
      remove: vi.fn(),
      removeTree: vi.fn(),
    },
    tabs: {
      query: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      captureVisibleTab: vi.fn(),
      onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    scripting: {
      executeScript: vi.fn(),
    },
  } as unknown) as typeof chrome,
});
