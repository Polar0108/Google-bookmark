import { useCallback, useEffect, useState } from 'react';

import { flattenBookmarks, loadAndCleanupBookmarkTree } from '../data/bookmarks';
import type { BookmarkViewModel } from '../types/bookmark';

export function useBookmarks(): {
  tree: BookmarkViewModel[];
  all: BookmarkViewModel[];
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
} {
  const [tree, setTree] = useState<BookmarkViewModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      const next = await loadAndCleanupBookmarkTree();
      setTree(next);
      setError(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法读取书签。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onMessage = (message: unknown): void => {
      if (
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message.type === 'BOOKMARKS_CHANGED'
      ) {
        void refresh();
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [refresh]);

  const result: {
    tree: BookmarkViewModel[];
    all: BookmarkViewModel[];
    loading: boolean;
    error?: string;
    refresh: () => Promise<void>;
  } = { tree, all: flattenBookmarks(tree), loading, refresh };
  if (error !== undefined) result.error = error;
  return result;
}

