# 轻阅

轻阅是一款面向 Windows 的本地、离线、免安装文档客户端。它可以编辑和阅读 Markdown、JSON、常见编程语言、配置文件、TXT、LOG、CSV，并提供 DOCX 与 XLSX 的轻量显示和编辑；Markdown 文件提供接近飞书文档阅读体验的实时编译预览。

## 下载

| 版本 | 极速便携 ZIP（推荐） | 单文件便携 EXE |
| --- | --- | --- |
| 完整版 1.3.3 | [下载 ZIP](https://github.com/HeYun0576/qingyue/releases/download/v1.3.3/QingYue-1.3.3-Fast-Portable-x64.zip) | [下载 EXE](https://github.com/HeYun0576/qingyue/releases/download/v1.3.3/QingYue-Markdown-1.3.3-Portable-x64.exe) |
| 轻量版 0.1.1 | [下载 ZIP](https://github.com/HeYun0576/qingyue/releases/download/lite-v0.1.1/QingYue-Lite-0.1.1-Fast-Portable-x64.zip) | [下载 EXE](https://github.com/HeYun0576/qingyue/releases/download/lite-v0.1.1/QingYue-Lite-0.1.1-Portable-x64.exe) |

两种形式均免安装，推荐将 ZIP 解压到固定目录后运行其中的 EXE。轻量版不含 Word/Excel 等重型功能，但仍携带 Electron 运行环境。

[全部发布版本](https://github.com/HeYun0576/qingyue/releases) · [历史归档说明与校验值](releases/README.md)。历史 1.0.0～1.3.2 只有原始发布包，没有原始源码快照；不会将新版源码作为旧版源码提供。

## 1.3.3 与 Lite 0.1.1

完整版 1.3.3 修复冷启动文件聚焦、目录遮挡和 Mermaid 文字缺失；新增默认阅读/编辑/分栏、无文档/空白文档/恢复历史三种启动策略、记住文件夹开关，以及桌面“新建 Markdown”。只保留标签栏的一个新建加号。

默认采用“无文档启动 + 分栏打开 Markdown + 不记住文件夹”。设置中点击“保存启动设置”后生效。全新启动仍会保存上次标签快照，可从空白页或设置中的“恢复上次标签”找回。历史未保存文档不会被自动写回原文件。

Lite 0.1.1 保留 Markdown、TXT、JSON/YAML 和代码文件的文本阅读编辑、目录、标签、书签批注、朗读、搜索、主题和 PDF/HTML/MD/TXT/RTF 导出；不含 Word/Excel、白板、思维导图编辑器、图片编辑、对比、结构校验和格式化。使用精简原生文本编辑器，不带 Monaco 的 IDE 语法服务/代码补全。Markdown 预览仍有代码高亮、公式和 Mermaid 图表，图表模块遇到相应内容才加载。单个文本文件上限 32 MB，8 MB 以上关闭预览。

完整版使用 `QingYue-Data`，轻量版使用 `QingYueLite-Data`，应用名、程序文件名和注册关联标识独立。两版可以共存，Windows 的默认打开程序由用户选择。

更多说明见 [1.3.3 更新说明](RELEASE-1.3.3.md)。

## 完整版已实现

- Markdown 左侧编辑、右侧实时预览
- 编辑 / 分栏 / 阅读三种布局
- F11 系统级全屏阅读，Esc 一键退出
- 阅读与全屏阅读支持 60%–250% 缩放，支持 Ctrl+滚轮、Ctrl++、Ctrl+-、Ctrl+0
- 阅读与全屏阅读支持 Left/Right、PageUp/PageDown、Space/Shift+Space 整页翻阅；Up/Down 保持小幅滚动
- 左侧滚动目录，点击标题时同步定位预览和 Markdown 编辑行
- CommonMark、表格、任务清单、脚注、数学公式、代码高亮、本地相对图片
- Monaco Editor 代码编辑体验，支持 JSON、JavaScript、TypeScript、Python、YAML、HTML、CSS、C/C++、Java、Go、Rust、SQL、Shell 等
- JSON 格式化、查找替换、撤销重做及 Monaco 内置编辑能力
- 多标签页；退出时保存会话，下次启动可选择恢复上次打开的文件、光标和阅读位置
- 未保存内容自动恢复，按文档保留历史快照，可从“历史”面板恢复为新标签
- 可打开固定文件夹树且不遮挡编辑区；按文件名或文本、Word、Excel 内容全局搜索；批量替换前自动写入 `.qingyue-backup` 备份
- Markdown 导出为带主题版式的 HTML、PDF、可继续编辑的 DOCX，以及 Markdown 原文和纯文本 TXT
- 跟随系统、明亮、深色、护眼、纸张主题，以及阅读字号、行宽设置；面板、菜单和弹窗均完整适配
- Mermaid 图表、带列表跳转的行书签、可编辑定位的文档批注和阅读进度条
- Word 阅读支持独立上下滚动和 60%–250% 缩放
- 系统语音朗读，支持选择 Windows 已安装语音、调节语速/音调/音量，以及拖动进度从当前可见段落或编辑光标处继续
- 标签页菜单支持关闭当前、关闭右侧和关闭全部，并提供简明内置使用帮助
- JSON / YAML 结构校验、可选 JSON Schema 校验；文本对比支持忽略空格/Tab、全量/仅差异、新增/删除/修改独立筛选、双栏行号和词级高亮
- 快捷键仅在轻阅窗口内生效，可在设置中自定义并自动检测重复；默认使用 Ctrl+Shift+B/M/D/E/L 等组合避开常见系统热键
- 本地离线白板（Excalidraw），支持自由绘制、形状、连线、便签、图片和 `.excalidraw` 保存
- 本地思维导图创建与编辑，支持轻阅 `.mindmap`、XMind、FreeMind、OPML 导入，以及 XMind 导出
- 常见图片打开、缩放、旋转、翻转、亮度/对比度编辑和副本保存；音频可直接播放
- Markdown 可插入图片、音频和其他附件，文件自动复制到文档同名 `.assets` 目录并写入相对链接
- 8 MB 以上自动切换轻量大文件模式，最高可按提示打开 256 MB 文本
- UTF-8、UTF-8 BOM、UTF-16 LE、GB18030 文本读取与原编码保存
- DOCX 语义化显示和文字、标题、列表、表格的轻量编辑
- XLSX 多工作表网格显示和单元格轻量编辑，保留原工作簿其余内容
- Office 文件首次保存强制使用副本名称，避免误覆盖复杂原件
- 从命令行、资源管理器“打开方式”和右键菜单打开文件
- 单实例文件转发、未保存修改保护、在文件夹中显示
- 注册表操作仅限当前用户，可在应用内完整移除

## 开发运行

```powershell
pnpm install
pnpm dev:app
```

## 生成免安装便携版

```powershell
pnpm dist:portable
```

发布时同时生成两种产物：

- `release/QingYue-1.3.3-Fast-Portable-x64.zip`：推荐。只需解压一次，之后直接运行 `QingYue.exe`，双击文件启动更快；
- `release/QingYue-Markdown-1.3.3-Portable-x64.exe`：单文件版，复制方便，但每次冷启动都需要先释放程序文件，速度会慢一些。
- `release/QingYue-Lite-0.1.1-Fast-Portable-x64.zip`：轻量版极速包，解压运行 `QingYueLite.exe`。
- `release/QingYue-Lite-0.1.1-Portable-x64.exe`：轻量版单文件包。

两种版本都免安装，应用数据保存在程序旁的 `QingYue-Data` 文件夹。移动程序后如曾注册文件关联，请在设置中先移除、再重新注册，使 Windows 指向新位置。

轻量版构建：`pnpm build:lite` → `pnpm stage:lite` → `pnpm exec electron-builder --projectDir release/lite-stage --win portable --x64 --publish never`。本地模块随应用打包，无须服务器、网络连接或首次下载。

## Office 轻量模式边界

- DOCX 以内容结构和可读性为主，不承诺复杂页眉页脚、文本框、批注、修订和精确分页的高保真还原；
- XLSX 支持前 500 行、100 列的轻量编辑；宏不执行，公式由 Excel 或其他完整表格软件重新计算；
- 轻阅首次保存 DOCX/XLSX 时默认创建“轻阅副本”，复杂原件建议继续保留。

## 文件关联说明

打开右上角设置，选择“注册文件关联”。轻阅会在当前用户注册表中：

1. 加入 Windows “打开方式”应用列表；
2. 为支持的文本扩展名加入名称仅为“轻阅”的右键菜单；
3. 注册便携 EXE 的真实路径。

Windows 10/11 为防止应用劫持默认程序，首次设为默认时仍需由用户在“打开方式”窗口勾选“始终使用此应用”。轻阅不会绕过这项系统保护，也不会强行覆盖已有默认应用。

## 安全与隐私

- 文件只在本机读取和保存，不上传到任何服务；
- Markdown 原生 HTML 默认禁用，并在显示前再次清理；
- 渲染进程启用上下文隔离、沙箱并关闭 Node.js 集成；
- 外部链接交给系统浏览器打开。
