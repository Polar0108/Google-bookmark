# Visual Bookmark 架构设计

## 1. 总体架构

Visual Bookmark 使用 Manifest V3，由以下运行上下文组成：

- `background` service worker：书签事件、侧边栏打开和跨上下文消息。
- `sidepanel` React 应用：主要 UI、搜索、文件夹导航和书签管理。
- `chrome.scripting.executeScript`：用户主动收藏时，由侧边栏注入一次性纯函数提取基础元数据；没有常驻 content script。
- `options` React 应用：存储、权限、主题和隐私设置。
- IndexedDB：本地视觉元数据、标签和 WebP 封面 Blob。
- `chrome.storage.sync`：体积较小的 UI 设置。

## 2. 技术栈

- WXT + Manifest V3
- React + TypeScript
- Dexie / IndexedDB
- MiniSearch 本地搜索
- 无尺寸测量依赖的 CSS 响应式双列网格
- CSS Modules/普通 CSS + 设计令牌
- Vitest + Testing Library

全部执行代码随扩展打包，不加载远程 JavaScript。

## 3. 权限

必需权限：

- `bookmarks`：读取和维护 Chrome 原生书签。
- `storage`：同步界面设置。
- `sidePanel`：扩展专属侧边栏。
- `activeTab`：用户点击扩展图标后临时访问当前标签页。
- `scripting`：在已授权当前页提取元数据。
- `favicon`：生成安全的 favicon URL。
- `unlimitedStorage`：本地保存截图封面，避免 10MB 上限。

`<all_urls>` host 权限是截图和批量刷新公开预览图的核心权限。扩展只在用户收藏当前页或主动点击“重新加载全部网站封面”时使用，不读取表单、Cookie 或登录凭据。

## 4. 数据模型

### BookmarkViewModel

由 Chrome `BookmarkTreeNode` 与本地元数据实时合并：

```ts
interface BookmarkViewModel {
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
  meta?: BookmarkMeta;
}
```

### BookmarkMeta

```ts
interface BookmarkMeta {
  bookmarkId: string;
  canonicalUrl: string;
  domain: string;
  siteName?: string;
  description?: string;
  tags: string[];
  coverAssetId?: string;
  coverSource: 'screenshot' | 'og' | 'upload' | 'generated' | 'none';
  dominantColor?: string;
  capturedAt?: number;
  lastOpenedAt?: number;
  schemaVersion: number;
}
```

### CoverAsset

```ts
interface CoverAsset {
  id: string;
  bookmarkId: string;
  mimeType: 'image/webp';
  width: number;
  height: number;
  byteSize: number;
  blob: Blob;
  createdAt: number;
}
```

### UserSettings

```ts
interface UserSettings {
  viewMode: 'list' | 'masonry';
  sortMode: 'created-desc' | 'created-asc' | 'title' | 'recently-opened';
  theme: 'system' | 'light' | 'dark';
  openInNewTab: boolean;
  showFolderBadge: boolean;
  onboardingComplete: boolean;
}
```

## 5. 数据一致性

- Chrome Bookmarks API 是标题、URL、文件夹和顺序的唯一事实来源。
- IndexedDB 只保存可丢弃或可重建的增强数据。
- service worker 监听 `onCreated`、`onChanged`、`onMoved`、`onRemoved`、`onChildrenReordered` 和 import 事件。
- 事件通过 `chrome.runtime.sendMessage` 广播给侧边栏。
- 删除书签后异步清理对应元数据与封面。
- 扩展启动时执行 orphan sweep，避免事件丢失造成无主图片。
- 数据库 schema 每次修改必须增加版本并提供迁移。

## 6. 截图流水线

1. 用户点击收藏后，侧边栏确认当前站点访问权限。
2. 侧边栏直接调用 `chrome.tabs.captureVisibleTab` 获取压缩后的当前可见区域，避免大图经过 runtime message 传输。
3. 一次性注入函数返回页面标题、URL、description、站点名和 Open Graph 图片地址；不读取正文和表单。
4. 侧边栏使用 `createImageBitmap` 与 Canvas：
   - 中心裁切至 16:10。
   - 最大宽度 960px。
   - WebP quality 0.78。
5. 图片以 Blob 写入 IndexedDB。
6. 原生书签创建成功后，事务写入 BookmarkMeta 与 CoverAsset。

若书签创建成功而元数据写入失败，保留原生书签并提示“已收藏，封面保存失败”。不得回滚或删除用户刚创建的原生书签。

## 7. 搜索

MiniSearch 索引字段：

- title
- URL
- domain
- description
- folder path
- tags

书签事件触发一次轻量刷新并重建内存索引；大量 import 在 `onImportEnded` 后统一刷新。索引只在内存中存在，启动时从 Chrome 书签与 Dexie 重建，避免索引迁移问题。

## 8. UI 响应式规则

- 侧边栏内容根节点声明 `container-type: inline-size`。
- CSS 网格使用 `auto-fill` 和 `128px` 最小卡片宽度决定 1–4 列。
- `<280px` 为 1 列、`280px` 起为 2 列、约 `416px` 起为 3 列、`552px` 起为 4 列。
- 约 `688px` 起强制固定四个等宽轨道，侧边栏继续变宽时只放大四列卡片。
- 图片容器固定 `aspect-ratio: 16 / 10`。
- 视觉卡片标题固定最多两行，避免高度剧烈变化。
- 视图切换和排序保存在 `chrome.storage.sync`。

## 9. 安全与隐私

- URL 仅允许 `http:`、`https:`、`file:`、`chrome:` 等 Chrome 可导航协议；自定义协议打开前要求用户确认。
- 页面 title、description 和标签按纯文本渲染，禁止 `dangerouslySetInnerHTML`。
- 所有外部链接使用明确的 Chrome Tabs API 打开。
- 不采集分析数据，不上传浏览记录，不访问 Cookie。
- 一次性注入函数只提取文档元数据，不读取表单、邮件正文或用户输入。
