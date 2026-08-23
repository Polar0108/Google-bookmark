import { SINGLE_COLUMN_BREAKPOINT } from '../constants';
import type { ViewMode } from '../types/bookmark';

export function getLaneCount(viewMode: ViewMode, width: number): 1 | 2 {
  return viewMode === 'masonry' && width >= SINGLE_COLUMN_BREAKPOINT ? 2 : 1;
}
