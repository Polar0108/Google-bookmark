import {
  BOOKMARK_CARD_MIN_WIDTH,
  BOOKMARK_GRID_GAP,
  BOOKMARK_VIEWPORT_HORIZONTAL_PADDING,
} from '../constants';
import type { ViewMode } from '../types/bookmark';

export function getLaneCount(viewMode: ViewMode, width: number): number {
  if (viewMode === 'list') return 1;
  const availableWidth = Math.max(0, width - BOOKMARK_VIEWPORT_HORIZONTAL_PADDING);
  return Math.min(
    4,
    Math.max(
      1,
      Math.floor((availableWidth + BOOKMARK_GRID_GAP) /
        (BOOKMARK_CARD_MIN_WIDTH + BOOKMARK_GRID_GAP)),
    ),
  );
}
