import { useEffect, useMemo, useState } from 'react';

import { deleteBookmark, moveBookmark, sortBookmarks } from '../data/bookmarks';
import { Icon } from '../components/Icon';
import { loadSettings, saveSettings } from '../data/settings';
import { useBookmarks } from '../hooks/useBookmarks';
import { captureCurrentTab, requestCaptureAccess } from '../services/capture';
import { recordBookmarkOpened, saveBookmarkCover } from '../services/enhancements';
import { updateRemoteBookmarkPreview } from '../services/remotePreview';
import { BookmarkSearchIndex } from '../services/search';
import type { BookmarkViewModel, CaptureResult, SortMode, UserSettings, ViewMode } from '../types/bookmark';
import { getNavigationSafety, isSameWebsiteFamily } from '../utils/url';
import { BookmarkViewport } from './BookmarkViewport';
import { CaptureDialog } from './CaptureDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { EditDialog } from './EditDialog';
import { FolderDialog } from './FolderDialog';
import { SortMenu } from './SortMenu';
import { TagDialog } from './TagDialog';

export function SidePanelApp() {
  const { all, loading, error, refresh } = useBookmarks();
  const [settings, setSettings] = useState<UserSettings>();
  const [query, setQuery] = useState('');
  const [folderId, setFolderId] = useState<string>();
  const [capture, setCapture] = useState<CaptureResult>();
  const [capturing, setCapturing] = useState(false);
  const [editTarget, setEditTarget] = useState<BookmarkViewModel>();
  const [deleteTargets, setDeleteTargets] = useState<BookmarkViewModel[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string>();
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkFolderId, setBulkFolderId] = useState('');
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [coverSync, setCoverSync] = useState<{ done: number; success: number; total: number }>();

  useEffect(() => { void loadSettings().then(setSettings); }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(undefined), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const folders = useMemo(() => all.filter((item) => item.isFolder && item.parentId), [all]);
  const urlBookmarks = useMemo(() => all.filter((item) => !item.isFolder && item.url), [all]);
  const currentFolder = folderId ? all.find((item) => item.id === folderId) : undefined;
  const scoped = useMemo(() => {
    if (!folderId) return urlBookmarks;
    return urlBookmarks.filter((item) => item.parentId === folderId);
  }, [folderId, urlBookmarks]);

  const index = useMemo(() => {
    const next = new BookmarkSearchIndex();
    next.rebuild(urlBookmarks);
    return next;
  }, [urlBookmarks]);

  const visibleBookmarks = useMemo(() => {
    const base = query.trim() ? index.query(query) : scoped;
    return sortBookmarks(base, settings?.sortMode ?? 'created-desc');
  }, [index, query, scoped, settings?.sortMode]);

  const childFolders = useMemo(() => {
    if (!folderId) return folders.filter((folder) => folder.folderPath.length === 0);
    return folders.filter((folder) => folder.parentId === folderId);
  }, [folderId, folders]);
  const parentFolderId = currentFolder?.parentId && folders.some((folder) => folder.id === currentFolder.parentId)
    ? currentFolder.parentId
    : undefined;

  const setViewMode = async (viewMode: ViewMode): Promise<void> => {
    setSettings((value) => value ? { ...value, viewMode } : value);
    await saveSettings({ viewMode });
  };

  const setSortMode = async (sortMode: SortMode): Promise<void> => {
    setSettings((value) => value ? { ...value, sortMode } : value);
    await saveSettings({ sortMode });
  };

  const openSettings = async (): Promise<void> => {
    try {
      await chrome.tabs.create({
        url: chrome.runtime.getURL('/options.html'),
        active: true,
      });
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : '无法打开设置页面。');
    }
  };

  const openBookmark = async (bookmark: BookmarkViewModel, newTab: boolean): Promise<void> => {
    if (!bookmark.url) return;
    const safety = getNavigationSafety(bookmark.url);
    if (safety === 'blocked') {
      setToast('出于安全原因，不能打开脚本或数据网址。');
      return;
    }
    if (safety === 'custom' && !window.confirm(`使用外部应用打开这个网址？\n\n${bookmark.url}`)) return;
    try {
      const shouldOpenNewTab = newTab || Boolean(settings?.openInNewTab);
      if (shouldOpenNewTab) {
        await chrome.tabs.create({ url: bookmark.url, active: true });
      } else {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id !== undefined) {
          const updatedTab = await chrome.tabs.update(tab.id, { url: bookmark.url });
          if (!updatedTab) throw new Error('无法打开书签。');
        } else await chrome.tabs.create({ url: bookmark.url, active: true });
      }
      void recordBookmarkOpened(bookmark).catch(() => undefined);
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : '无法打开书签。');
    }
  };

  const recaptureBookmark = async (bookmark: BookmarkViewModel): Promise<void> => {
    if (!bookmark.url) return;
    setCapturing(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id === undefined || !tab.url) throw new Error('无法读取当前网页。');
      if (!isSameWebsiteFamily(bookmark.url, tab.url)) {
        throw new Error('当前页面与该书签不属于同一网站，不能作为它的封面。');
      }
      const granted = await requestCaptureAccess();
      if (!granted) throw new Error('需要允许访问网页，才能保存当前页面截图。');
      const result = await captureCurrentTab();
      if (!isSameWebsiteFamily(bookmark.url, result.metadata.url)) {
        throw new Error('截图期间页面已切换到其他网站，请返回原网站后重试。');
      }
      if (!result.screenshotDataUrl) throw new Error('当前页面无法截图。');
      await saveBookmarkCover(bookmark, result.screenshotDataUrl, 'screenshot');
      setToast('封面已更新为当前网站页面');
      await refresh();
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : '更新封面失败。');
    } finally {
      setCapturing(false);
    }
  };

  const startCapture = async (): Promise<void> => {
    setCapturing(true);
    try {
      const granted = await requestCaptureAccess();
      if (!granted) {
        setToast('需要允许访问网页，才能读取说明并保存截图。');
        return;
      }
      setCapture(await captureCurrentTab());
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : '无法捕获当前页面截图。');
    } finally {
      setCapturing(false);
    }
  };

  const syncAllCovers = async (): Promise<void> => {
    if (coverSync) return;
    const targets = urlBookmarks.filter((item) => /^https?:/i.test(item.url ?? ''));
    if (!targets.length) return;
    let cursor = 0;
    let done = 0;
    let success = 0;
    setCoverSync({ done, success, total: targets.length });

    const worker = async (): Promise<void> => {
      while (cursor < targets.length) {
        const targetIndex = cursor;
        cursor += 1;
        const bookmark = targets[targetIndex];
        if (!bookmark) continue;
        const result = await updateRemoteBookmarkPreview(bookmark);
        if (result.updated) {
          success += 1;
        }
        done += 1;
        setCoverSync({ done, success, total: targets.length });
      }
    };

    try {
      await Promise.all(Array.from({ length: Math.min(6, targets.length) }, worker));
      await refresh();
      const failed = targets.length - success;
      setToast(failed
        ? `已刷新 ${success} 个封面，${failed} 个网站处理失败`
        : `已刷新全部 ${success} 个网站封面`);
    } finally {
      setCoverSync(undefined);
    }
  };

  const performDelete = async (): Promise<void> => {
    setDeleting(true);
    try {
      for (const target of deleteTargets) await deleteBookmark(target);
      setToast(deleteTargets.length > 1 ? `已删除 ${deleteTargets.length} 个书签` : '已删除书签');
      setSelectedIds(new Set());
      setSelectMode(false);
      setDeleteTargets([]);
      await refresh();
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : '删除失败。');
    } finally {
      setDeleting(false);
    }
  };

  const bulkMove = async (): Promise<void> => {
    if (!bulkFolderId || !selectedIds.size) return;
    try {
      await Promise.all([...selectedIds].map((id) => moveBookmark(id, bulkFolderId)));
      setToast(`已移动 ${selectedIds.size} 个书签`);
      setSelectedIds(new Set());
      setSelectMode(false);
      await refresh();
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : '批量移动失败。');
    }
  };

  const toggleSelected = (id: string): void => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!settings) return <div className="app-loading">正在加载 Visual Bookmark…</div>;

  return (
    <main className={`sidepanel-app${settings.showFolderBadge ? '' : ' hide-folder-badge'}`} data-theme="dark">
      <div className="search-box">
        <span aria-hidden="true"><Icon name="search" size={17} /></span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、网站、文件夹或标签" aria-label="搜索书签" />
        {query ? <button type="button" onClick={() => setQuery('')} aria-label="清除搜索"><Icon name="x" size={15} /></button> : null}
      </div>

      <section className="bookmark-shell">
        <header className="bookmark-toolbar">
          <div className="bookmark-toolbar__title">
            {folderId ? <button type="button" onClick={() => setFolderId(parentFolderId)} aria-label="返回上级文件夹"><Icon name="arrow-left" size={16} /></button> : null}
            <strong>{query ? '搜索结果' : currentFolder?.title ?? '所有书签'}</strong>
            {!folderId && !query ? (
              <button
                className={`bookmark-refresh-button${coverSync ? ' is-syncing' : ''}`}
                type="button"
                disabled={Boolean(coverSync) || !urlBookmarks.length}
                onClick={() => void syncAllCovers()}
                aria-label={coverSync ? `正在刷新网站封面 ${coverSync.done}/${coverSync.total}` : '重新加载全部网站封面'}
                title={coverSync ? `正在刷新 ${coverSync.done}/${coverSync.total}` : '重新加载全部网站封面'}
              >
                <Icon name="refresh" size={14} />
              </button>
            ) : null}
            <span>{coverSync ? `${coverSync.done}/${coverSync.total}` : visibleBookmarks.length}</span>
          </div>
          <div className="bookmark-toolbar__actions">
            <SortMenu value={settings.sortMode} onChange={(value) => void setSortMode(value)} />
            <button className="mode-button" type="button" aria-label="新建文件夹" onClick={() => setFolderDialogOpen(true)}><Icon name="folder-plus" size={15} /></button>
            <button className="mode-button" type="button" aria-label="列表模式" aria-pressed={settings.viewMode === 'list'} onClick={() => void setViewMode('list')}><Icon name="list" size={15} /></button>
            <button className="mode-button" type="button" aria-label="视觉模式" aria-pressed={settings.viewMode === 'masonry'} onClick={() => void setViewMode('masonry')}><Icon name="grid" size={15} /></button>
            <button className="mode-button" type="button" aria-label="多选" aria-pressed={selectMode} onClick={() => { setSelectMode((value) => !value); setSelectedIds(new Set()); }}><Icon name="check-square" size={15} /></button>
            <button className="mode-button" type="button" onClick={() => void openSettings()} aria-label="在新标签页打开设置"><Icon name="settings" size={15} /></button>
          </div>
        </header>

        {!query && childFolders.length ? (
          <nav className="folder-strip" aria-label="书签文件夹">
            {childFolders.map((folder) => (
              <button key={folder.id} type="button" onClick={() => setFolderId(folder.id)}><span><Icon name="folder" size={14} /></span>{folder.title}</button>
            ))}
          </nav>
        ) : null}

        {loading ? <div className="skeleton-list" aria-label="正在加载书签"><i /><i /><i /><i /></div> : null}
        {error ? <div className="error-state"><strong>无法读取书签</strong><span>{error}</span><button type="button" onClick={() => void refresh()}>重试</button></div> : null}
        {!loading && !error ? (
          <BookmarkViewport
            bookmarks={visibleBookmarks}
            viewMode={settings.viewMode}
            selectedIds={selectedIds}
            selectMode={selectMode}
            onOpen={(bookmark, newTab) => void openBookmark(bookmark, newTab)}
            onEdit={setEditTarget}
            onRecapture={(bookmark) => void recaptureBookmark(bookmark)}
            onDelete={(bookmark) => setDeleteTargets([bookmark])}
            onToggleSelected={toggleSelected}
          />
        ) : null}
      </section>

      {selectMode && selectedIds.size ? (
        <div className="bulk-bar">
          <strong>已选 {selectedIds.size}</strong>
          <select value={bulkFolderId} onChange={(event) => setBulkFolderId(event.target.value)} aria-label="批量移动到文件夹">
            <option value="">移动到…</option>
            {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.title}</option>)}
          </select>
          <button type="button" disabled={!bulkFolderId} onClick={() => void bulkMove()}>移动</button>
          <button type="button" onClick={() => setTagDialogOpen(true)}>标签</button>
          <button className="danger-text" type="button" onClick={() => setDeleteTargets(urlBookmarks.filter((item) => selectedIds.has(item.id)))}>删除</button>
        </div>
      ) : null}

      <footer className="capture-bar">
        <button className="primary-button primary-button--wide" type="button" disabled={capturing} onClick={() => void startCapture()}>
          <Icon name="plus" size={17} />{capturing ? '正在读取当前页面…' : '添加当前标签页'}
        </button>
      </footer>

      {capture ? <CaptureDialog capture={capture} folders={folders} onClose={() => setCapture(undefined)} onSaved={(message) => { setToast(message); void refresh(); }} /> : null}
      {editTarget ? <EditDialog bookmark={editTarget} folders={folders} onClose={() => setEditTarget(undefined)} onSaved={() => { setToast('已保存更改'); void refresh(); }} /> : null}
      {folderDialogOpen ? <FolderDialog folders={folders} {...(folderId ? { initialParentId: folderId } : {})} onClose={() => setFolderDialogOpen(false)} onCreated={(createdId) => { setFolderId(createdId); setToast('文件夹已新建'); void refresh(); }} /> : null}
      {tagDialogOpen ? <TagDialog bookmarks={urlBookmarks.filter((item) => selectedIds.has(item.id))} onClose={() => setTagDialogOpen(false)} onSaved={() => { setToast('标签已添加'); setSelectedIds(new Set()); setSelectMode(false); void refresh(); }} /> : null}
      {deleteTargets.length ? <ConfirmDialog title={deleteTargets.length > 1 ? '删除所选书签？' : '删除书签？'} message={deleteTargets.length > 1 ? `将从 Chrome 中删除 ${deleteTargets.length} 个书签，此操作无法撤销。` : `“${deleteTargets[0]?.title ?? ''}”将从 Chrome 原生书签中删除。`} busy={deleting} onCancel={() => setDeleteTargets([])} onConfirm={() => void performDelete()} /> : null}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </main>
  );
}
