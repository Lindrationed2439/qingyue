# 首页展示素材

## 来源

截图与动图录自已发布的完整版 **1.3.3** 和 Lite **0.1.1** 的原始 `app.asar` 前端及 preload，未重绘界面，也未替换按钮、文字、功能结果或样式。动图为真实交互状态帧，播放停顿经过调整，不是启动速度测试。

全部文档来自 [examples/演示文档](../../examples/演示文档)。录制运行于独立、不可见的 Electron 窗口和临时配置目录，文件读取限制在演示目录内。使用真实文件内容与原版文件树逻辑；保存、恢复和注册状态由无副作用的录制适配层隔离，不访问个人历史，不注册文件关联。所有 HTTP/HTTPS 请求在录制过程中被阻止。

录制不代表对所有功能的端到端测试。截图清单、尺寸、文件 SHA-256、交互顺序与录制校验结果见 [manifest.json](manifest.json)。

## 素材

| 文件 | 内容 |
| --- | --- |
| [split-view.png](split-view.png) | 完整版分栏编辑、真实文件夹树与标签页 |
| [reading-outline.png](reading-outline.png) | 阅读模式与不遮挡正文的左侧目录 |
| [dark-mode.png](dark-mode.png) | 深色主题、Mermaid 图表与阅读提示 |
| [lite-reading.png](lite-reading.png) | Lite 纸张阅读主题 |
| [qingyue-demo.gif](qingyue-demo.gif) | 实时编辑 → 阅读 → 目录 → 缩放 → 主题 |

## 复现

先安装项目依赖，并准备对应已发布版本的解包目录。默认查找：

```text
release/v1.3.3-build/win-unpacked/resources/app.asar
release/lite/win-unpacked/resources/app.asar
```

也可以用 `QINGYUE_FULL_ASAR`、`QINGYUE_LITE_ASAR` 指定准确路径；脚本会检查版本号。使用 Python 3.11+ 和 Pillow 编码动图。确保未设置 `ELECTRON_RUN_AS_NODE` 后运行：

```powershell
pnpm exec electron scripts/capture-showcase.cjs
python scripts/encode-showcase.py
```

原始帧和隔离配置仅保存在被 Git 忽略的 `release/.github-media/`；仓库只保存最终素材、来源清单、演示文档和复现脚本。
