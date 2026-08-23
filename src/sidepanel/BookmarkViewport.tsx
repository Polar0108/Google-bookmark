import type { BookmarkViewModel, ViewMode } from '../types/bookmark';
import { BookmarkCard } from './BookmarkCard';

interface BookmarkViewportProps {
  bookmarks: BookmarkViewModel[];
  viewMode: ViewMode;
  selectedIds: Set<string>;
  selectMode: boolean;
  onOpen: (bookmark: BookmarkViewModel, newTab: boolean) => void;
  onEdit: (bookmark: BookmarkViewModel) => void;
  onRecapture: (bookmark: BookmarkViewModel) => void;
  onDelete: (bookmark: BookmarkViewModel) => void;
  onToggleSelected: (id: string) => void;
}

export function BookmarkViewport(props: BookmarkViewportProps) {
  if (!props.bookmarks.length) {
    return (
      <div className="empty-state">
        <strong>这里还没有书签</strong>
        <span>收藏当前页面，或清除搜索条件后再试。</span>
      </div>
    );
  }

  return (
    <div className="bookmark-viewport">
      <div className={`bookmark-collection bookmark-collection--${props.viewMode}`}>
        {props.bookmarks.map((bookmark) => (
          <BookmarkCard
            key={bookmark.id}
            bookmark={bookmark}
            viewMode={props.viewMode}
            selected={props.selectedIds.has(bookmark.id)}
            selectMode={props.selectMode}
            onOpen={props.onOpen}
            onEdit={props.onEdit}
            onRecapture={props.onRecapture}
            onDelete={props.onDelete}
            onToggleSelected={props.onToggleSelected}
          />
        ))}
      </div>
    </div>
  );
}
