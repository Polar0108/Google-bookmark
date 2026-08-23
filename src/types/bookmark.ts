export type ViewMode = 'list' | 'masonry';

export type SortMode =
  | 'created-desc'
  | 'created-asc'
  | 'title'
  | 'recently-opened';

export type CoverSource =
  | 'screenshot'
  | 'og'
  | 'upload'
  | 'generated'
  | 'none';

export interface BookmarkMeta {
  bookmarkId: string;
  canonicalUrl: string;
  domain: string;
  siteName?: string;
  description?: string;
  tags: string[];
  coverAssetId?: string;
  coverSource: CoverSource;
  dominantColor?: string;
  capturedAt?: number;
  lastOpenedAt?: number;
  schemaVersion: number;
}

export interface CoverAsset {
  id: string;
  bookmarkId: string;
  mimeType: 'image/webp';
  width: number;
  height: number;
  byteSize: number;
  blob: Blob;
  createdAt: number;
}

export interface BookmarkViewModel {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  index?: number;
  dateAdded?: number;
  dateLastUsed?: number;
  folderPath: string[];
  isFolder: boolean;
  isManaged: boolean;
  children?: BookmarkViewModel[];
  meta?: BookmarkMeta;
}

export interface UserSettings {
  viewMode: ViewMode;
  sortMode: SortMode;
  theme: 'system' | 'light' | 'dark';
  openInNewTab: boolean;
  showFolderBadge: boolean;
  onboardingComplete: boolean;
}

export interface PageMetadata {
  title: string;
  url: string;
  description?: string;
  siteName?: string;
  imageUrl?: string;
}

export interface CaptureResult {
  metadata: PageMetadata;
  screenshotDataUrl?: string;
  tabId: number;
  windowId: number;
}

