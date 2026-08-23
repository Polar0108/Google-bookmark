import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { BookmarkCard } from '../src/sidepanel/BookmarkCard';
import type { BookmarkViewModel } from '../src/types/bookmark';

const bookmark: BookmarkViewModel = {
  id: 'bookmark',
  title: 'Visual bookmark test page',
  url: 'https://example.com/page',
  folderPath: ['参考'],
  isFolder: false,
  isManaged: false,
  meta: {
    bookmarkId: 'bookmark',
    canonicalUrl: 'https://example.com/page',
    domain: 'example.com',
    description: 'A saved page description',
    tags: [],
    coverSource: 'none',
    schemaVersion: 1,
  },
};

describe('BookmarkCard', () => {
  it('opens a bookmark from the main button', () => {
    const onOpen = vi.fn();
    render(
      <BookmarkCard
        bookmark={bookmark}
        viewMode="masonry"
        selected={false}
        selectMode={false}
        onOpen={onOpen}
        onEdit={vi.fn()}
        onRecapture={vi.fn()}
        onDelete={vi.fn()}
        onToggleSelected={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^打开 Visual bookmark test page$/i }));
    expect(onOpen).toHaveBeenCalledWith(bookmark, false);
    expect(screen.getByText('example.com')).toBeVisible();
    expect(screen.queryByText('A saved page description')).not.toBeInTheDocument();
    expect(screen.queryByText('https://example.com/page')).not.toBeInTheDocument();
  });

  it('toggles selection instead of navigating in select mode', () => {
    const onOpen = vi.fn();
    const onToggleSelected = vi.fn();
    render(
      <BookmarkCard
        bookmark={bookmark}
        viewMode="list"
        selected={false}
        selectMode
        onOpen={onOpen}
        onEdit={vi.fn()}
        onRecapture={vi.fn()}
        onDelete={vi.fn()}
        onToggleSelected={onToggleSelected}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^打开 Visual bookmark test page$/i }));
    expect(onToggleSelected).toHaveBeenCalledWith(bookmark.id);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
