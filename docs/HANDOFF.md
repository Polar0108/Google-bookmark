# Visual Bookmark 开发交接文档

更新时间：2026-08-23  
当前版本：0.1.9  
目标平台：Google Chrome 116+ / Manifest V3

## 1. 项目概览

Visual Bookmark 是一个本地优先的 Chrome 侧边栏扩展。Chrome 原生书签负责保存标题、网址和文件夹层级；扩展在 IndexedDB 中保存 WebP 封面、标签和其他视觉增强数据。

当前产品采用固定暗色界面，支持视觉卡片和列表模式、搜索、排序、文件夹导航、批量管理、当前页面收藏以及网站封面生成。

## 2. 当前关键行为

- 卡片只展示 16:10 封面、标题、网站来源以及底部操作栏，不直接展示完整网址或描述。
- 没有封面的书签在用户打开后自动截图。截图会等待动态内容稳定、加载占位消失、字体和可见图片就绪。
- 已有封面的书签普通打开时不会更新封面。
- 卡片底部刷新按钮可以用当前可见页面覆盖封面，但只允许书签所属网站的页面和子域名；跨网站页面会被拦截。
- 同一标签页快速连续打开书签时，只有最后一次任务可以保存封面，避免截图串位。
- “所有书签”标题旁的刷新按钮会重新处理全部网站封面：优先使用 Open Graph/Twitter 预览图，失败时在本地使用 favicon、标题和域名生成暗色封面。
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

生成内容位于 `.output/`，属于可重建产物，不提交到 Git。

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
| `src/services/autoCover.ts` | 无封面自动截图、动态页面等待与并发任务取消 |
| `src/services/capture.ts` | 当前活动标签页元数据和可见区域截图 |
| `src/services/remotePreview.ts` | 批量读取公开预览图与生成封面兜底 |
| `src/services/enhancements.ts` | 封面、标签和增强元数据事务写入 |
| `src/services/image.ts` | 16:10 裁切、WebP 编码、favicon 与生成封面 |
| `src/utils/url.ts` | 导航安全和同网站归属判断 |
| `src/data/bookmarks.ts` | Chrome 原生书签读取、转换和 CRUD |
| `src/data/database.ts` | Dexie / IndexedDB schema 与清理逻辑 |
| `src/styles/global.css` | 侧边栏暗色设计令牌和响应式布局 |
| `test/` | Vitest 单元测试与 React 组件测试 |

更完整的数据模型和运行上下文见 `docs/ARCHITECTURE.md`。

## 6. 封面流程

### 无封面自动截图

1. 用户点击无封面的书签卡片。
2. 扩展打开目标标签页并建立该标签页的唯一截图任务。
3. 等待 `complete`、动态 DOM 稳定、可见加载占位消失、字体与可见图片就绪。
4. 保存当前可见区域并裁切为 16:10 WebP。
5. 如果用户在等待期间点击另一书签，旧任务失效，不允许写入。

### 手动更新封面

1. 用户先打开书签所属网站的任意页面或子页面。
2. 点击对应卡片底部刷新按钮。
3. `isSameWebsiteFamily` 在截图前、等待后和截图后验证网站归属。
4. 验证通过后覆盖旧封面；跨网站时只提示错误，不写入。

### 批量刷新

标题旁刷新按钮以 4 个并发任务处理全部 HTTP(S) 书签。网站公开图片不可用时会生成稳定的本地暗色封面，因此不要把单个站点拒绝跨域或缺少 OG 图片视为整体失败。

## 7. 本地数据与跨设备说明

- Chrome 原生书签可由用户自己的 Chrome Sync 同步。
- `chrome.storage.sync` 只同步少量界面设置。
- 封面 Blob、标签和增强元数据保存在扩展 IndexedDB，不会随 Git 或 Chrome 书签自动同步。
- 在另一台设备克隆代码并安装扩展后，可点击标题旁刷新按钮重新生成封面。
- 卸载扩展会删除本地增强数据，但不会删除 Chrome 原生书签。

## 8. 权限与隐私边界

- `<all_urls>` 用于当前页面截图和读取书签网站公开预览图。
- 扩展不读取 Cookie、密码、表单内容或邮件正文。
- 页面脚本只检查加载状态和读取公开元数据，不注入远程代码。
- 所有截图和封面保存在本机，不上传到项目作者的服务器。
- `chrome://` 页面和 Chrome Web Store 等浏览器保护页面无法截图。

## 9. 验证与发布

当前基线：

- TypeScript：通过。
- ESLint：通过。
- Vitest：13 个测试文件、45 项测试通过。
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
- 截图等待采用视觉稳定启发式，极慢或持续动画的网站可能在最长等待时间到达后截图。
- 批量刷新依赖目标网站允许扩展读取页面和图片；失败时会生成本地封面。
- 大量本地截图可能占用较多空间，可在设置页查看统计或清除封面。
- 若未来实现跨设备封面同步，需要独立设计配额、加密、隐私披露和冲突解决，不应直接放入 `chrome.storage.sync`。

## 11. 提交前检查

- 不提交 `node_modules/`、`.output/`、`.wxt/`、`Visual-Bookmark-Extension/` 或 `.DS_Store`。
- 不提交浏览器资料、Cookie、截图数据库或任何凭据。
- 确认 Manifest 权限变化已经同步更新隐私政策与商店文案。
- 确认新增交互包含错误状态、无障碍名称和对应测试。
