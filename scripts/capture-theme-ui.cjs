const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

app.whenReady().then(async () => {
  ipcMain.handle('session:load', () => null);
  ipcMain.handle('session:save', () => true);
  ipcMain.handle('history:save', () => true);
  ipcMain.handle('history:list', () => []);
  const window = new BrowserWindow({
    width: 1600,
    height: 1000,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'electron', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const errors = [];
  window.webContents.on('console-message', (_event, level, message) => {
    if (level >= 3 && !message.includes('Electron Security Warning')) errors.push(message);
  });
  await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  await pause(1400);

  const themeState = await window.webContents.executeJavaScript(`(async () => {
    const select = document.querySelector('#theme-select');
    select.value = 'dark'; select.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('#project-button').click();
    document.querySelector('#project-name').textContent = '项目文档';
    document.querySelector('#file-tree').innerHTML = [
      ['folder-opened','01_产品介绍',0], ['markdown','README.md',1], ['markdown','待办清单.md',1],
      ['folder-opened','03_数据',0], ['file','数据表.xlsx',1], ['json','配置.json',1], ['file-code','main.py',0]
    ].map(([icon,name,depth]) => '<button class="tree-item '+(icon === 'folder-opened' ? 'directory' : 'file')+'" style="padding-left:'+(8+depth*13)+'px"><i class="codicon codicon-'+icon+'"></i><span>'+name+'</span></button>').join('');
    document.querySelector('#tab-menu-button').click();
    await new Promise((resolve) => setTimeout(resolve, 200));
    const color = (selector, property = 'backgroundColor') => getComputedStyle(document.querySelector(selector))[property];
    return {
      theme: document.querySelector('.app-shell').dataset.theme,
      brandColor: color('.brand-name', 'color'),
      shellBackground: color('.app-shell'),
      projectBackground: color('.project-panel'),
      tabMenuBackground: color('.tab-menu'),
      projectOpen: document.querySelector('.project-panel').classList.contains('open'),
    };
  })()`);
  window.showInactive(); await pause(450);
  const mainImage = await window.capturePage();
  const mainPath = path.join(__dirname, '..', 'dist', 'v122-dark-main.png');
  await fs.writeFile(mainPath, mainImage.toPNG());

  await window.webContents.executeJavaScript(`(() => {
    document.querySelector('#tab-menu').hidden = true;
    const modal = document.querySelector('#utility-modal');
    modal.hidden = false; modal.querySelector('.utility-card').classList.add('wide');
    document.querySelector('#utility-title').textContent = '差异对比 · 旧版配置.json → 配置.json';
    document.querySelector('#utility-content').innerHTML = '<div class="diff-summary"><div><strong>旧版配置.json</strong><i class="codicon codicon-arrow-right"></i><strong>配置.json</strong></div><div class="diff-counts"><span class="modified">修改 2</span><span class="added">新增 1</span><span class="removed">删除 1</span></div></div><div class="diff-toolbar"><div class="diff-mode"><button class="active">仅差异</button><button>全量显示</button></div><span id="diff-position">1 / 4</span><button class="button ghost">上一处</button><button class="button ghost">下一处</button></div><div class="diff-columns"><strong>旧版配置.json（对比文件）</strong><strong>配置.json（当前文件）</strong></div><div class="diff-view"><div class="diff-row diff-modified active-difference"><div class="diff-line-number">3</div><pre>  &quot;theme&quot;: &quot;<mark class="word-removed">light</mark>&quot;</pre><div class="diff-status">修改</div><div class="diff-line-number">3</div><pre>  &quot;theme&quot;: &quot;<mark class="word-added">system</mark>&quot;</pre></div><div class="diff-row diff-added"><div class="diff-line-number"></div><pre>&nbsp;</pre><div class="diff-status">新增</div><div class="diff-line-number">8</div><pre>  &quot;autosave&quot;: true</pre></div><div class="diff-row diff-removed"><div class="diff-line-number">9</div><pre>  &quot;legacy&quot;: true</pre><div class="diff-status">删除</div><div class="diff-line-number"></div><pre>&nbsp;</pre></div></div>';
  })()`);
  await pause(250);
  const diffImage = await window.capturePage();
  const diffPath = path.join(__dirname, '..', 'dist', 'v122-dark-diff.png');
  await fs.writeFile(diffPath, diffImage.toPNG());

  const additionalThemes = {};
  for (const theme of ['eye', 'paper']) {
    additionalThemes[theme] = await window.webContents.executeJavaScript(`(() => {
      document.querySelector('#utility-modal').hidden = true;
      const select = document.querySelector('#theme-select');
      select.value = '${theme}'; select.dispatchEvent(new Event('change', { bubbles: true }));
      return {
        theme: document.querySelector('.app-shell').dataset.theme,
        background: getComputedStyle(document.querySelector('.app-shell')).backgroundColor,
        panel: getComputedStyle(document.querySelector('.project-panel')).backgroundColor,
        text: getComputedStyle(document.querySelector('.brand-name')).color,
      };
    })()`);
    await pause(180);
    const themedImage = await window.capturePage();
    const themedPath = path.join(__dirname, '..', 'dist', `v122-${theme}-main.png`);
    await fs.writeFile(themedPath, themedImage.toPNG());
    additionalThemes[theme].imagePath = themedPath;
  }

  console.log(JSON.stringify({ ...themeState, errors, mainPath, diffPath, additionalThemes }, null, 2));
  const white = 'rgb(255, 255, 255)';
  if (themeState.theme !== 'dark' || themeState.projectBackground === white || themeState.tabMenuBackground === white || themeState.brandColor === themeState.shellBackground || errors.length) process.exitCode = 1;
  window.destroy(); app.quit();
}).catch((error) => { console.error(error); app.quit(); process.exitCode = 1; });
