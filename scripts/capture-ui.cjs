const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const startedAt = Date.now();
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

app.whenReady().then(async () => {
  ipcMain.handle('session:load', () => null);
  ipcMain.handle('session:save', () => true);
  ipcMain.handle('history:save', () => true);
  ipcMain.handle('history:list', () => []);
  const window = new BrowserWindow({
    width: 1604,
    height: 1074,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'electron', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const consoleErrors = [];
  window.webContents.on('console-message', (_event, level, message) => {
    if (level >= 3 && !message.includes('Electron Security Warning')) consoleErrors.push(message);
  });
  window.webContents.on('render-process-gone', (_event, details) => consoleErrors.push(`render-process-gone: ${details.reason}`));
  await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  await pause(1400);
  await window.webContents.executeJavaScript(`window.__smokeErrors = []; window.addEventListener('error', (event) => window.__smokeErrors.push(event.error?.stack || event.message))`);
  const firstReady = Date.now() - startedAt;

  await window.webContents.executeJavaScript(`document.querySelector('.monaco-editor textarea').focus()`);
  window.webContents.debugger.attach('1.3');
  await window.webContents.debugger.sendCommand('Input.insertText', { text: '# 轻阅 · 本地离线文档体验\n\n## 简介\n轻阅是一款 Windows 本地、离线、免安装的文档客户端，轻松打开、编辑与阅读多种格式文档。\n\n## 功能亮点\n- [x] 左侧资源树，中央编辑与预览\n- [x] 阅读缩放、整页翻阅和朗读\n- [x] 自动恢复、书签与文档批注\n\n## 支持格式\n\n| 格式 | 用途 | 支持情况 |\n| --- | --- | --- |\n| Markdown | 文档、笔记 | 完整支持 |\n| DOCX | Word 文档 | 轻量编辑 |\n| XLSX | 电子表格 | 多表查看 |\n| JSON / YAML | 配置数据 | 结构校验 |\n\n## 代码示例（Python）\n\n```python\ndef hello(name: str) -> str:\n    return f"Hello, {name}!"\n```\n' });
  window.webContents.debugger.detach();
  await pause(1100);

  const state = await window.webContents.executeJavaScript(`(async () => {
    document.querySelector('#project-button').click();
    document.querySelector('#project-name').textContent = '项目文档';
    document.querySelector('#file-tree').innerHTML = [
      ['folder-opened','01_产品介绍',0], ['markdown','README.md',1], ['markdown','待办清单.md',1],
      ['folder-opened','02_设计稿',0], ['folder-opened','03_数据',0], ['file','数据表.xlsx',1],
      ['json','配置.json',1], ['folder-opened','日志',0], ['file','日志.txt',1], ['file-code','main.py',0]
    ].map(([icon,name,depth]) => '<button class="tree-item '+(icon === 'folder-opened' ? 'directory' : 'file')+'" style="padding-left:'+(8+depth*13)+'px"><i class="codicon codicon-'+icon+'"></i><span>'+name+'</span></button>').join('');
    document.querySelector('#bookmark-button').click();
    document.querySelector('#utility-content .button.primary')?.click();
    const bookmarkListed = Boolean(document.querySelector('.marker-row'));
    document.querySelector('#utility-close').click();
    document.querySelector('#help-button').click();
    const helpVisible = !document.querySelector('#utility-modal').hidden && Boolean(document.querySelector('.help-grid'));
    document.querySelector('#utility-close').click();
    document.querySelector('#speech-button').click();
    const speechVisible = Boolean(document.querySelector('#speech-voice'));
    const speechProgressVisible = Boolean(document.querySelector('#speech-progress'));
    document.querySelector('#utility-close').click();
    document.querySelector('#creative-button').click();
    document.querySelector('#creative-whiteboard').click();
    await new Promise((resolve) => setTimeout(resolve, 3500));
    const whiteboardVisible = Boolean(document.querySelector('.excalidraw-host .excalidraw'));
    document.querySelector('#utility-close').click();
    document.querySelector('#creative-button').click();
    document.querySelector('#creative-mindmap').click();
    await new Promise((resolve) => setTimeout(resolve, 2200));
    const mindmapVisible = Boolean(document.querySelector('.mindmap-host svg'));
    document.querySelector('#utility-close').click();
    document.querySelector('#new-tab').click(); document.querySelector('#new-tab').click();
    const beforeClose = document.querySelectorAll('.document-tab').length;
    document.querySelector('.document-tab:first-child').click();
    document.querySelector('#tab-menu-button').click();
    document.querySelector('[data-tab-action="close-right"]').click();
    await new Promise((resolve) => setTimeout(resolve, 120));
    const afterClose = document.querySelectorAll('.document-tab').length;
    document.querySelectorAll('.tab-name').forEach((node, index) => { node.textContent = ['README.md','待办清单.md','配置.json'][index] || node.textContent; });
    document.querySelector('.document-tab:first-child')?.click();
    document.querySelector('#project-panel').style.cssText += ';transition:none;transform:translateX(0);visibility:visible'; document.querySelector('.workspace').style.cssText += ';transition:none;padding-left:310px';
    document.querySelector('#project-panel').classList.add('open'); document.querySelector('.workspace').classList.add('project-open');
    return {
      firstReadyMs: ${firstReady}, bookmarkListed, helpVisible, speechVisible, speechProgressVisible, whiteboardVisible, mindmapVisible, beforeClose, afterClose,
      projectPush: document.querySelector('.workspace').classList.contains('project-open'),
      projectPanelOpen: document.querySelector('#project-panel').classList.contains('open'),
      projectPadding: getComputedStyle(document.querySelector('.workspace')).paddingLeft,
      pageErrors: window.__smokeErrors,
    };
  })()`);
  window.showInactive();
  await pause(700);
  const image = await window.capturePage();
  const imagePath = path.join(__dirname, '..', 'dist', 'v121-ui-final2.png');
  await fs.writeFile(imagePath, image.toPNG());
  const result = { ...state, consoleErrors, imagePath };
  await fs.writeFile(path.join(__dirname, '..', 'dist', 'smoke-result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!state.bookmarkListed || !state.helpVisible || !state.speechVisible || !state.speechProgressVisible || !state.whiteboardVisible || !state.mindmapVisible || !state.projectPush || state.afterClose >= state.beforeClose || consoleErrors.length || state.pageErrors.length) process.exitCode = 1;
  window.destroy(); app.quit();
}).catch((error) => { console.error(error); app.quit(); process.exitCode = 1; });
