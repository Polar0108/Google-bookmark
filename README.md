# Visual Bookmark

Visual Bookmark 是一个本地优先的 Chrome 视觉书签扩展。它使用扩展专属侧边栏展示 Chrome 原生书签，在列表与视觉卡片之间切换，并为用户主动收藏的页面保存本地截图封面。

## 产品原则

- Chrome 原生书签是标题、URL、文件夹层级的唯一事实来源。
- 侧边栏是主入口，不覆盖 Chrome 新标签页，也不尝试修改 Chrome 原生书签侧边栏。
- 视觉模式默认两列，仅在内容区域小于 280px 时降为一列；宽侧栏仍保持两列。
- 卡片封面采用标准网页截图比例 `16:10`，不使用 Pinterest 式高低不一的图片比例。
- 截图、标签和扩展元数据仅保存在本机；卸载扩展不会删除原生书签。
- 网站访问权限用于捕获当前页面截图，并在用户点击标题旁的“重新加载全部网站封面”时读取书签网站公开的预览图；没有公开大图时会在本地生成站点封面，不会读取表单或 Cookie。
- 使用扩展添加当前标签页，或使用 Chrome 原生收藏按钮保存当前网页时，都会立即保存当时的可见区域截图；普通点击书签只负责打开页面，永远不会自动替换封面。
- 卡片底部的刷新按钮会立即截取当前页面，但只允许书签所属网站及其子页面、子域名，跨网站截图会被拦截。
- 列表模式使用网站 favicon，视觉模式使用截图；排序菜单与触发控件左边缘对齐；设置页始终在新的浏览器标签页中打开。
- 品牌图标使用深石墨、暖白与少量冷蓝色，以“图片缩略图 + 书签页签”表达可视化收藏，不再使用绿色底色。

详细文档：

- [产品需求](docs/PRD.md)
- [架构设计](docs/ARCHITECTURE.md)
- [开发与验收计划](docs/DEVELOPMENT_PLAN.md)
- [隐私政策](docs/PRIVACY.md)
- [安装与验收](docs/INSTALLATION.md)
- [商店文案](docs/STORE_LISTING.md)
- [发布清单](docs/RELEASE_CHECKLIST.md)
- [测试报告](docs/TEST_REPORT.md)
- [最终审核报告](docs/AUDIT_REPORT.md)
- [开发交接文档](docs/HANDOFF.md)

## 开发

安装依赖后运行：

```bash
pnpm dev
```

构建、检查和测试：

```bash
pnpm check
pnpm test
pnpm build
pnpm zip
```

构建产物位于 `.output/chrome-mv3/`，并会自动同步到本地加载目录 `Visual-Bookmark-Extension/`；压缩包位于 `.output/`。

## 当前交付状态

- Chrome 116+ / Manifest V3。
- 生产构建、压缩包、类型检查、代码规则检查和自动化测试均已配置。
- 不需要后端服务、账号或 API Key。
- 上架前仅需由发布者补充隐私政策中的主体、邮箱、生效日期与公开托管地址。
