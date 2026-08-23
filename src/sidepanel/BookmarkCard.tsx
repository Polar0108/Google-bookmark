import { Icon } from '../components/Icon';
import { getFaviconUrl } from '../services/image';
import type { BookmarkViewModel, ViewMode } from '../types/bookmark';
import { useCoverUrl } from '../hooks/useCoverUrl';

interface BookmarkCardProps {
  bookmark: BookmarkViewModel;
  viewMode: ViewMode;
  selected: boolean;
  selectMode: boolean;
  onOpen: (bookmark: BookmarkViewModel, newTab: boolean) => void;
  onEdit: (bookmark: BookmarkViewModel) => void;
  onRecapture: (bookmark: BookmarkViewModel) => void;
  onDelete: (bookmark: BookmarkViewModel) => void;
  onToggleSelected: (id: string) => void;
}

export function BookmarkCard({
  bookmark,
  viewMode,
  selected,
  selectMode,
  onOpen,
  onEdit,
  onRecapture,
  onDelete,
  onToggleSelected,
}: BookmarkCardProps) {
  const coverUrl = useCoverUrl(viewMode === 'masonry' ? bookmark.meta?.coverAssetId : undefined);
  const domain = bookmark.meta?.domain || safeDomain(bookmark.url);
  const favicon = bookmark.url ? getFaviconUrl(bookmark.url) : undefined;

  const activate = (event: React.MouseEvent): void => {
    if (selectMode) {
      if (bookmark.isManaged) return;
      onToggleSelected(bookmark.id);
      return;
    }
    onOpen(bookmark, event.metaKey || event.ctrlKey || event.button === 1);
  };

  return (
    <article
      className={`bookmark-card bookmark-card--${viewMode}${selectMode ? ' is-selecting' : ''}${selected ? ' is-selected' : ''}`}
      data-bookmark-id={bookmark.id}
    >
      {selectMode ? (
        <label className="bookmark-card__check">
          <input
            type="checkbox"
            checked={selected}
            disabled={bookmark.isManaged}
            onChange={() => onToggleSelected(bookmark.id)}
            aria-label={`选择 ${bookmark.title}`}
          />
        </label>
      ) : null}
      <button
        className="bookmark-card__main"
        type="button"
        aria-label={`打开 ${bookmark.title}`}
        onClick={activate}
        onAuxClick={(event) => {
          if (event.button !== 1 || selectMode) return;
          event.preventDefault();
          onOpen(bookmark, true);
        }}
      >
        <span className="bookmark-card__cover" aria-hidden="true">
          {viewMode === 'list' ? (
            <span className="bookmark-card__favicon" data-domain={domain}>
              {favicon ? <img src={favicon} alt="" /> : domain.slice(0, 1).toUpperCase()}
            </span>
          ) : coverUrl ? (
            <img src={coverUrl} alt="" />
          ) : (
            <span className="bookmark-card__placeholder" data-domain={domain}>
              {favicon ? <img src={favicon} alt="" /> : domain.slice(0, 1).toUpperCase()}
            </span>
          )}
        </span>
        <span className="bookmark-card__copy">
          <strong>{bookmark.title}</strong>
        </span>
      </button>
      {!selectMode ? (
        <footer className="bookmark-card__footer">
          <span className="bookmark-card__site" title={bookmark.meta?.siteName || domain}>
            {favicon ? <img src={favicon} alt="" /> : null}
            <span>{bookmark.meta?.siteName || domain || '本地书签'}</span>
          </span>
          <span className="bookmark-card__actions">
            <button className="icon-button icon-button--small" type="button" onClick={() => onRecapture(bookmark)} aria-label={`用当前网站页面更新 ${bookmark.title} 的封面`}><Icon name="refresh" size={13} /></button>
            <button className="icon-button icon-button--small" type="button" onClick={() => onEdit(bookmark)} aria-label={`编辑 ${bookmark.title}`}><Icon name="pencil" size={13} /></button>
            <button className="icon-button icon-button--small danger-text" type="button" disabled={bookmark.isManaged} onClick={() => onDelete(bookmark)} aria-label={`删除 ${bookmark.title}`}><Icon name="trash" size={13} /></button>
          </span>
        </footer>
      ) : null}
    </article>
  );
}

function safeDomain(url?: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
