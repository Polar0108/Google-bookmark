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
    const { container } = render(
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
    expect(container.querySelector('.bookmark-card--list.is-selecting')).toBeInTheDocument();
    expect(container.querySelector('.bookmark-card__check')).toBeInTheDocument();
  });

  it('uses the website favicon instead of a saved screenshot in list mode', () => {
    const { container } = render(
      <BookmarkCard
        bookmark={{
          ...bookmark,
          meta: {
            ...bookmark.meta!,
            coverAssetId: 'saved-screenshot',
            coverSource: 'screenshot',
          },
        }}
        viewMode="list"
        selected={false}
        selectMode={false}
        onOpen={vi.fn()}
        onEdit={vi.fn()}
        onRecapture={vi.fn()}
        onDelete={vi.fn()}
        onToggleSelected={vi.fn()}
      />,
    );

    const favicon = container.querySelector<HTMLImageElement>('.bookmark-card__favicon img');
    expect(favicon).toBeInTheDocument();
    expect(favicon?.src).toContain('/_favicon/');
    expect(container.querySelector('.bookmark-card__cover > img')).not.toBeInTheDocument();
  });

  it('shows an immediate screenshot preview while a manual cover refresh is saving', () => {
    const { container } = render(
      <BookmarkCard
        bookmark={bookmark}
        viewMode="masonry"
        selected={false}
        selectMode={false}
        coverOverrideUrl="data:image/jpeg;base64,instant-preview"
        refreshing
        refreshDisabled
        onOpen={vi.fn()}
        onEdit={vi.fn()}
        onRecapture={vi.fn()}
        onDelete={vi.fn()}
        onToggleSelected={vi.fn()}
      />,
    );

    expect(container.querySelector<HTMLImageElement>('.bookmark-card__cover > img')?.src)
      .toBe('data:image/jpeg;base64,instant-preview');
    const refreshButton = screen.getByRole('button', { name: '正在更新 Visual bookmark test page 的封面' });
    expect(refreshButton).toBeDisabled();
    expect(refreshButton).toHaveAttribute('aria-busy', 'true');
  });
});
