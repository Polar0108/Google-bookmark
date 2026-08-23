import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { BookmarkViewport } from '../src/sidepanel/BookmarkViewport';
import type { BookmarkViewModel } from '../src/types/bookmark';

const bookmarks: BookmarkViewModel[] = [
  {
    id: 'first',
    title: 'First imported bookmark',
    url: 'https://example.com/first',
    folderPath: ['Bookmarks bar'],
    isFolder: false,
    isManaged: false,
  },
  {
    id: 'second',
    title: 'Second imported bookmark',
    url: 'https://example.com/second',
    folderPath: ['Other bookmarks'],
    isFolder: false,
    isManaged: false,
  },
];

describe('BookmarkViewport', () => {
  it('renders every native bookmark as a visible card without layout measurement', () => {
    render(
      <BookmarkViewport
        bookmarks={bookmarks}
        viewMode="masonry"
        selectedIds={new Set()}
        selectMode={false}
        onOpen={vi.fn()}
        onEdit={vi.fn()}
        onRecapture={vi.fn()}
        onDelete={vi.fn()}
        onToggleSelected={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '打开 First imported bookmark' })).toBeVisible();
    expect(screen.getByRole('button', { name: '打开 Second imported bookmark' })).toBeVisible();
  });
});
