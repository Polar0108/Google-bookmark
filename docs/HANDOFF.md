# Visual Bookmark 开发交接文档

更新时间：2026-08-24
当前版本：0.1.10  
目标平台：Google Chrome 116+ / Manifest V3

## 1. 项目概览

Visual Bookmark 是一个本地优先的 Chrome 侧边栏扩展。Chrome 原生书签负责保存标题、网址和文件夹层级；扩展在 IndexedDB 中保存 WebP 封面、标签和其他视觉增强数据。

当前产品采用固定暗色界面，支持视觉卡片和列表模式、搜索、排序、文件夹导航、批量管理、当前页面收藏以及网站封面生成。

## 2. 当前关键行为

- 卡片只展示 16:10 封面、标题、网站来源以及底部操作栏，不直接展示完整网址或描述。
- 用户点击“添加当前标签页”或 Chrome 原生收藏按钮时，立即捕获当时的可见区域，并把该截图保存为新书签封面。
- 普通打开书签永远不会创建或替换封面；只有添加书签、卡片手动刷新、上传封面或顶部批量刷新能够修改封面。
- 卡片底部刷新按钮会立即用当前可见页面覆盖封面，不再等待页面、字体或图片稳定；只允许书签所属网站的页面和子域名，跨网站页面会被拦截。
- “所有书签”标题旁的刷新按钮会重新处理全部网站封面：优先使用 Open Graph/Twitter 预览图，失败时在本地使用 favicon、标题和域名生成暗色封面。
- 列表模式只显示 18px 网站 favicon，不读取截图；视觉模式继续显示 16:10 截图。
- 排序使用从触发控件左边缘对齐展开的不透明暗色菜单；列表多选框位于独立左侧列，图标和标题随之右移。
- 点击设置按钮会新建标签页打开 `options.html`，不会覆盖当前网页。
- 扩展品牌图标使用深石墨底、暖白图片缩略图和冷蓝书签页签；主图形在 Chrome 地址栏的固定 16px 区域内仅保留约 1px 安全边距。源文件为 `public/icon/source.svg`，构建使用 16/32/48/128px PNG。
- Chrome 原生书签始终是书签内容的唯一事实来源，扩展不会建立独立的云端书签数据库。

## 3. 环境准备

建议使用：

- Node.js 20 或更高版本。
- pnpm 11；项目在 `package.json` 中固定为 `pnpm@11.19.0`。
- Google Chrome 116 或更高版本。

克隆后执行：

```bash
corepack enable
pnpm install
pnpm check
pnpm test
pnpm build
```

开发模式：

```bash
pnpm dev
```

商店压缩包：

```bash
pnpm zip
```

生成内容位于 `.output/`，`pnpm build` 还会自动同步一份到 `Visual-Bookmark-Extension/`。两者都属于可重建产物，不提交到 Git；该同步用于避免 Chrome 继续加载旧的本地解压目录。

## 4. Chrome 本地安装

1. 执行 `pnpm build`。
2. 打开 `chrome://extensions`。
3. 开启“开发者模式”。
4. 选择“加载已解压的扩展程序”。
5. 选择 `.output/chrome-mv3`。
6. 将网站访问权限设置为“在所有网站上”，否则截图和批量封面刷新会失败。
7. 修改代码并重新构建后，在扩展管理页点击“重新加载”。

## 5. 目录与职责

| 路径 | 职责 |
| --- | --- |
| `entrypoints/background.ts` | 侧边栏入口、书签事件和后台消息 |
| `src/sidepanel/SidePanelApp.tsx` | 侧边栏主状态、导航、批量刷新和收藏入口 |
| `src/sidepanel/BookmarkCard.tsx` | 可视化书签卡片与操作栏 |
| `src/sidepanel/SortMenu.tsx` | 自定义暗色排序下拉菜单 |
| `src/services/capture.ts` | 当前活动标签页元数据和可见区域截图 |
| `src/services/nativeBookmarkCover.ts` | Chrome 原生收藏事件的即时截图、页面一致性校验与封面保存 |
| `src/services/remotePreview.ts` | 批量读取公开预览图与生成封面兜底 |
| `src/services/enhancements.ts` | 封面、标签和增强元数据事务写入 |
| `src/services/image.ts` | 16:10 裁切、WebP 编码、favicon 与生成封面 |
| `src/utils/url.ts` | 导航安全和同网站归属判断 |
| `src/data/bookmarks.ts` | Chrome 原生书签读取、转换和 CRUD |
| `src/data/database.ts` | Dexie / IndexedDB schema 与清理逻辑 |
| `src/styles/global.css` | 侧边栏暗色设计令牌和响应式布局 |
| `public/icon/` | 扩展品牌 SVG 源文件与 Chrome 所需的多尺寸 PNG |
| `test/` | Vitest 单元测试与 React 组件测试 |

更完整的数据模型和运行上下文见 `docs/ARCHITECTURE.md`。

## 6. 封面流程

### 新增书签封面

1. 用户在目标网页点击“添加当前标签页”时，扩展立即读取页面基础元数据并捕获当前可见区域。
2. 收藏确认框显示截图预览；用户保存后中心裁切为 16:10 WebP 并写入 IndexedDB。
3. 用户改用 Chrome 原生收藏按钮时，后台只在活动标签页 URL 与新书签 URL 完全一致（忽略 `#fragment`）时即时截图，并直接保存封面。
4. 原生收藏截图完成后再次确认标签页与 URL，快速切换标签页时会丢弃截图，避免封面串到其他书签。
5. 普通点击任何书签都只执行导航与最近使用时间记录，不触发截图。

### 手动更新封面

1. 用户先打开书签所属网站的任意页面或子页面。
2. 点击对应卡片底部刷新按钮。
3. `isSameWebsiteFamily` 在截图前和截图后验证网站归属。
4. 验证通过后覆盖旧封面；跨网站时只提示错误，不写入。
5. 截图没有人为延迟，点击后立即捕获当前可见状态；加载态也会按当时画面保存。

### 批量刷新

标题旁刷新按钮以最多 6 个并发任务处理全部 HTTP(S) 书签，网页请求超时 7 秒、图片请求超时 8 秒。批量任务结束后统一刷新列表，避免每完成一项就重读全部书签。网站公开图片不可用时会生成稳定的本地暗色封面，因此不要把单个站点拒绝跨域或缺少 OG 图片视为整体失败。

外部网页 HTML 只经过纯文本白名单扫描，提取 `meta` 和 `link rel="image_src"`；禁止使用 `DOMParser` 或把外部 HTML 写入扩展 DOM，否则目标网站的脚本预加载标签可能触发 Manifest V3 CSP 错误。

## 7. 本地数据与跨设备说明

- Chrome 原生书签可由用户自己的 Chrome Sync 同步。
- `chrome.storage.sync` 只同步少量界面设置。
- 封面 Blob、标签和增强元数据保存在扩展 IndexedDB，不会随 Git 或 Chrome 书签自动同步。
- 在另一台设备克隆代码并安装扩展后，可点击标题旁刷新按钮重新生成封面。
- 卸载扩展会删除本地增强数据，但不会删除 Chrome 原生书签。

## 8. 权限与隐私边界

- `<all_urls>` 用于当前页面截图和读取书签网站公开预览图。
- 扩展不读取 Cookie、密码、表单内容或邮件正文。
- 页面脚本只读取收藏所需的公开元数据，不注入远程代码，也不等待或跟踪页面加载状态。
- 所有截图和封面保存在本机，不上传到项目作者的服务器。
- `chrome://` 页面和 Chrome Web Store 等浏览器保护页面无法截图。

## 9. 验证与发布

当前基线：

- TypeScript：通过。
- ESLint：通过。
- Vitest：14 个测试文件、48 项测试通过。
- WXT 生产构建与 ZIP：通过。

每次交付至少运行：

```bash
pnpm check
pnpm test
pnpm build
pnpm zip
```

版本号位于 `package.json`。完成打包后同步更新 `docs/INSTALLATION.md` 和 `docs/TEST_REPORT.md` 中的版本、测试数量和 ZIP SHA-256。

## 10. 已知限制与后续建议

- 当前同网站判断使用内置的常见公共后缀和托管平台列表；若新增特殊国家域名或托管域名，应同时补充 `src/utils/url.ts` 与 `test/url.test.ts`。
- 新增与手动刷新采用即时截图；如果页面仍在加载，封面会保留用户点击时看到的加载状态。
- 批量刷新依赖目标网站允许扩展读取页面和图片；失败时会生成本地封面。
- 大量本地截图可能占用较多空间，可在设置页查看统计或清除封面。
- 若未来实现跨设备封面同步，需要独立设计配额、加密、隐私披露和冲突解决，不应直接放入 `chrome.storage.sync`。

## 11. 提交前检查

- 不提交 `node_modules/`、`.output/`、`.wxt/`、`Visual-Bookmark-Extension/` 或 `.DS_Store`。
- 不提交浏览器资料、Cookie、截图数据库或任何凭据。
- 确认 Manifest 权限变化已经同步更新隐私政策与商店文案。
- 确认新增交互包含错误状态、无障碍名称和对应测试。
