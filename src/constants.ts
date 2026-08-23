import type { UserSettings } from './types/bookmark';

export const DEFAULT_SETTINGS: UserSettings = {
  viewMode: 'masonry',
  sortMode: 'created-desc',
  theme: 'system',
  openInNewTab: false,
  showFolderBadge: true,
  onboardingComplete: false,
};

export const SINGLE_COLUMN_BREAKPOINT = 280;
export const COVER_ASPECT_RATIO = 16 / 10;
export const COVER_MAX_WIDTH = 960;
export const COVER_WEBP_QUALITY = 0.78;
export const META_SCHEMA_VERSION = 1;

