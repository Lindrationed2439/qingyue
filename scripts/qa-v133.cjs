// Runs the real built UI and preload in isolated, hidden Electron windows. Never changes user settings or associations.
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'qa-v133');
const packaged = process.argv.includes('--packaged');
const artifactRoot = edition => path.join(root, 'release', edition === 'lite' ? 'lite' : 'v1.3.3-build', 'win-unpacked', 'resources', 'app.asar');
app.setPath('userData', path.join(out, 'isolated-profile'));
app.on('window-all-closed', () => { /* The test suite creates the next isolated window. */ });
const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const states = new Map();
const results = [];
const fixture = '# 当前文档\n\n## 架构图\n\n```mermaid\nflowchart LR\n A[用户入口] --> B[业务服务]\n B --> C[数据存储]\n```\n\n```mermaid\nsequenceDiagram\n participant A as 浏览器\n participant B as 服务器\n A->>B: 请求数据\n B-->>A: 返回结果\n```\n\n' + Array.from({ length: 12 }, (_, i) => `## 章节 ${i + 1}\n\n` + '这是用于阅读、目录跳转和滚动测试的段落。\n\n'.repeat(8)).join('');
const oldSession = { activeTabId: 'old1', projectRoot: 'C:\\qa\\project', tabs: [{ id: 'old1', kind: 'text', name: '历史一.md', path: 'C:\\qa\\old.md', encoding: 'utf8', view: 'edit', dirty: false }, { id: 'old2', kind: 'text', name: '草稿.md', content: '# 未保存草稿', dirty: true, view: 'split' }] };
const target = 'C:\\qa\\当前.md';
const getState = e => states.get(e.sender.id);
const opened = p => ({ path: p, name: p.split(/[\\/]/).pop(), content: p.endsWith('.json') ? '{"key":1,"nested":{"value":true}}' : p.endsWith('.yaml') ? 'root: {item: 1, next: 2}\n' : p.includes('old') ? '# 历史文档' : fixture, encoding: 'utf8', size: 1000, modifiedAt: Date.now() });
for (const [name, fn] of Object.entries({
  'app:take-startup-files': e => getState(e).initial || [],
  'app:renderer-ready': e => getState(e).late || [],
  'session:load': async e => { await pause(getState(e).delay || 0); return getState(e).history ?? oldSession; },
  'session:save': (e, value) => { getState(e).saved = value; return true; },
  'session:archive': e => { getState(e).archived = getState(e).history ?? oldSession; return true; },
  'session:archived': e => getState(e).archived,
  'history:save': () => true, 'history:list': () => [],
  'file:read': (_e, value) => opened(typeof value === 'string' ? value : value.path),
  'file:write': (e, value) => { getState(e).written = value; return opened(value.path); },
  'dialog:open': () => target, 'dialog:save-as': () => 'C:\\qa\\saved.md',
  'dialog:open-folder': () => 'C:\\qa\\project',
  'workspace:tree': (e, value) => { getState(e).trees = (getState(e).trees || 0) + 1; return { root: value, items: [{ type: 'file', name: '当前.md', path: target, relative: '当前.md', depth: 0 }], truncated: false }; },
  'registry:status': () => ({ registered: false }),
  'app:info': () => ({ version: '1.3.3', packaged: true, portable: true }),
  'window:get-fullscreen': () => false, 'window:set-fullscreen': () => true,
  'office:read-docx': async (_e, p) => { await pause(700); return { ...opened(p), html: '<p>旧 Word 文档</p>', warnings: [] }; },
})) ipcMain.handle(name, fn);

async function runJs(w, code) { try { return await w.webContents.executeJavaScript(code, true); } catch(error) { throw new Error(`${error.message}\nScript: ${code}\nConsole: ${JSON.stringify(states.get(w.webContents.id)?.errors)}`); } }
async function until(w, expression, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { if (await runJs(w, expression)) return; await pause(80); }
  throw new Error(`Timed out: ${expression}`);
}
async function click(w, selector) { await runJs(w, `document.querySelector(${JSON.stringify(selector)}).click()`); }
async function boot(edition, prefs, initial = [], extra = {}) {
  const state = { initial: [], history: { tabs: [] }, errors: [], ...extra };
  const appRoot = packaged ? artifactRoot(edition) : root;
  const w = new BrowserWindow({ width: 1440, height: 930, show: false, webPreferences: { backgroundThrottling: false, offscreen: true, preload: path.join(appRoot, 'electron/preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, partition: `qa-${Date.now()}-${Math.random()}` } });
  states.set(w.webContents.id, state);
  w.webContents.on('console-message', (_e, level, message) => { if (level >= 3 && !message.includes('Electron Security Warning')) state.errors.push(message); });
  w.webContents.on('render-process-gone', (_e, detail) => state.errors.push(detail.reason));
  const location = path.join(appRoot, edition === 'lite' && !packaged ? 'dist-lite' : 'dist', 'index.html');
  await w.loadFile(location); await until(w, `document.querySelector('.app-shell')?.dataset.ready === 'true'`);
  await runJs(w, `localStorage.setItem('qingyue-startup-settings', ${JSON.stringify(JSON.stringify(prefs))});localStorage.setItem('qingyue-project-root','C:\\\\qa\\\\project');localStorage.setItem('qingyue-project-open','true')`);
  Object.assign(state, { initial, history: oldSession, trees: 0, ...extra });
  const start = Date.now();
  await w.loadFile(location); await until(w, `document.querySelector('.app-shell')?.dataset.ready === 'true'`);
  state.readyMs = Date.now() - start;
  return { w, state };
}
async function layout(w, mode, both = false) {
  await click(w, `[data-mode="${mode}"]`);
  await runJs(w, `if (!document.querySelector('.workspace').classList.contains('outline-open')) document.querySelector('#outline-button').click(); if (${both} && !document.querySelector('.workspace').classList.contains('project-open')) document.querySelector('#project-button').click()`);
  await pause(260);
  const boxes = await runJs(w, `(() => { const r = s => {const b=document.querySelector(s).getBoundingClientRect();return {left:b.left,right:b.right,width:b.width}}; return {outline:r('#outline-panel'),project:r('#project-panel'),editor:r('.editor-pane'),preview:r('.preview-pane'),width:innerWidth}; })()`);
  const content = mode === 'preview' ? boxes.preview : boxes.editor;
  assert.ok(content.left >= boxes.outline.right - 2, JSON.stringify({ mode, both, boxes }));
  assert.ok(content.width > 100, JSON.stringify(boxes));
  assert.ok(content.right <= boxes.width + 2, JSON.stringify(boxes));
  if (both) assert.ok(boxes.outline.left >= boxes.project.right - 2, JSON.stringify(boxes));
  return boxes;
}
async function inspectDiagrams(w, theme) {
  await runJs(w, `(() => {const theme=document.querySelector('#theme-select');theme.value=${JSON.stringify(theme)};theme.dispatchEvent(new Event('change'))})()`);
  await until(w, `document.querySelectorAll('.mermaid-diagram svg').length === 2`);
  const info = await runJs(w, `(() => {const nodes=[...document.querySelectorAll('.mermaid-diagram svg text,.mermaid-diagram svg foreignObject span,.mermaid-diagram svg foreignObject p')].filter(n => n.textContent.trim());return {errors:[...document.querySelectorAll('.mermaid-error')].map(n=>n.textContent),labels:nodes.map(n=>({text:n.textContent,fill:getComputedStyle(n).fill,color:getComputedStyle(n).color,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height}))}})()`);
  await fs.writeFile(path.join(out, 'diagram-debug.html'), await runJs(w, `document.querySelector('#preview').innerHTML`));
  await fs.writeFile(path.join(out, 'diagram-debug.png'), (await w.capturePage()).toPNG());
  assert.equal(info.errors.length, 0);
  assert.ok(info.labels.some(n => n.text.includes('用户入口') && n.width > 0 && n.height > 0), JSON.stringify(info));
  assert.ok(info.labels.some(n => n.text.includes('浏览器') && n.width > 0), JSON.stringify(info));
  return { theme, ...info };
}

app.whenReady().then(async () => {
  await fs.mkdir(out, { recursive: true });
  if (packaged) {
    const fullPackage = JSON.parse(await fs.readFile(path.join(artifactRoot('full'), 'package.json'), 'utf8'));
    const litePackage = JSON.parse(await fs.readFile(path.join(artifactRoot('lite'), 'package.json'), 'utf8'));
    assert.equal(fullPackage.version, '1.3.3'); assert.equal(litePackage.version, '0.1.1');
    assert.equal(litePackage.qingyueEdition, 'lite');
    assert.deepEqual(Object.keys(litePackage.dependencies), ['iconv-lite']);
    assert.ok(!(await fs.readdir(path.join(artifactRoot('lite'), 'electron'))).includes('office.cjs'));
    const liteModules = await fs.readdir(path.join(artifactRoot('lite'), 'node_modules'));
    for (const dependency of ['exceljs','mammoth','docx','monaco-editor','@excalidraw','simple-mind-map']) assert.ok(!liteModules.includes(dependency), dependency);
    assert.ok(liteModules.includes('iconv-lite') && liteModules.includes('safer-buffer'));
    const assets = await fs.readdir(path.join(artifactRoot('lite'), 'dist/assets'));
    assert.ok(!assets.some(name => /worker-|full-|excalidraw|^ajv-|^client-/.test(name)));
  }
  for (const edition of ['full', 'lite']) {
    let { w, state } = await boot(edition, { startupMode: 'empty', defaultView: 'preview', rememberFolder: false }, [target], { delay: 200 });
    assert.equal(await runJs(w, `document.querySelectorAll('.document-tab').length`), 1);
    assert.equal(await runJs(w, `document.querySelector('.document-tab.active .tab-name').textContent`), '当前.md');
    assert.equal(await runJs(w, `document.querySelector('.app-shell').dataset.view`), 'preview');
    assert.equal(state.trees, 0);
    assert.equal(await runJs(w, `document.querySelectorAll('#new-button').length`), 0);
    const layouts = [];
    for (const width of [1440, 900]) {
      w.setSize(width, 930);
      for (const mode of ['split', 'preview', 'edit']) layouts.push({ width, mode, boxes: await layout(w, mode, true) });
    }
    w.setSize(1440, 930); await layout(w, 'preview', true);
    const diagrams = [];
    for (const theme of ['light', 'dark', 'eye', 'paper']) diagrams.push(await inspectDiagrams(w, theme));
    await inspectDiagrams(w, 'dark');
    await fs.writeFile(path.join(out, `${edition}-dark.png`), (await w.capturePage()).toPNG());
    await click(w, '.outline-link:last-child'); await pause(500);
    const jumped = await runJs(w, `({scroll:document.querySelector('#preview-scroll').scrollTop,cursor:document.querySelector('#cursor-status').textContent})`);
    assert.ok(jumped.scroll > 100, JSON.stringify(jumped));
    assert.ok(Number(jumped.cursor.match(/第 (\d+) 行/)?.[1]) > 2, JSON.stringify(jumped));
    if (edition === 'lite') {
      assert.ok(await runJs(w, `!['none','normal','""'].includes(getComputedStyle(document.querySelector('#export-button .codicon'), '::before').content)`));
      assert.equal(await runJs(w, `document.querySelectorAll('#creative-button,#format-button,#validate-button,#diff-button,.monaco-editor').length`), 0);
      await click(w, '[data-mode="edit"]');
      await runJs(w, `const input=document.querySelector('.lite-input');input.value='# 修改成功';input.dispatchEvent(new Event('input'))`);
      await click(w, '#save-button'); await pause(150);
      assert.equal(state.written.content, '# 修改成功');
    } else {
      w.webContents.send('app:open-files', ['C:\\qa\\test.json']);
      await until(w, `document.querySelector('.document-tab.active .tab-name')?.textContent==='test.json'`);
      await click(w, '#format-button'); await pause(200); await click(w, '#save-button'); await pause(150);
      assert.match(state.written.content, /\n  "key"/);
      w.webContents.send('app:open-files', ['C:\\qa\\test.yaml']);
      await until(w, `document.querySelector('.document-tab.active .tab-name')?.textContent==='test.yaml'`);
      await click(w, '#format-button'); await pause(300); await click(w, '#save-button'); await pause(100);
      assert.match(state.written.content, /root:/);
    }
    assert.deepEqual(state.errors, []);
    results.push({ edition, scenario: 'explicit-fresh-file', readyMs: state.readyMs, layouts, diagrams, errors: state.errors });
    w.destroy();

    ({ w, state } = await boot(edition, { startupMode: 'restore', defaultView: 'preview', rememberFolder: true }, [target], { delay: 200 }));
    assert.equal(await runJs(w, `document.querySelectorAll('.document-tab').length`), 3);
    assert.equal(await runJs(w, `document.querySelector('.document-tab.active .tab-name').textContent`), '当前.md');
    assert.equal(state.trees, 1);
    w.webContents.send('app:open-files', ['C:\\qa\\old.md']); await pause(250);
    assert.equal(await runJs(w, `document.querySelector('.document-tab.active .tab-name').textContent`), '历史一.md');
    await click(w, '#settings-button');
    await runJs(w, `document.querySelector('#default-view-select').value='edit';document.querySelector('#startup-mode-select').value='blank';document.querySelector('#remember-folder-check').checked=false;document.querySelector('#save-startup-settings').click()`);
    const savedPrefs = await runJs(w, `JSON.parse(localStorage.getItem('qingyue-startup-settings'))`);
    assert.deepEqual(savedPrefs, { defaultView: 'edit', startupMode: 'blank', rememberFolder: false });
    results.push({ edition, scenario: 'restore-then-explicit-wins-and-settings-save', errors: state.errors }); w.destroy();

    for (const startupMode of ['empty', 'blank']) {
      ({ w, state } = await boot(edition, { startupMode, defaultView: 'split', rememberFolder: false }));
      assert.equal(await runJs(w, `document.querySelectorAll('.document-tab').length`), startupMode === 'empty' ? 0 : 1);
      if (startupMode === 'empty') {
        assert.equal(await runJs(w, `document.querySelector('.app-shell').dataset.empty`), 'true');
        await click(w, '#empty-recover'); await until(w, `document.querySelectorAll('.document-tab').length===2`);
      }
      results.push({ edition, scenario: startupMode, errors: state.errors }); w.destroy();
    }
  }
  // A file received while a slow Office history is loading must win after restoration.
  const delayed = structuredClone(oldSession); delayed.tabs.push({ id: 'word', kind: 'docx', path: 'C:\\qa\\old.docx', name: '旧 Word.docx' });
  const { w, state } = await boot('full', { startupMode: 'restore', defaultView: 'preview' }, [], { history: delayed, late: [target] });
  assert.equal(await runJs(w, `document.querySelector('.document-tab.active .tab-name').textContent`), '当前.md');
  await pause(1700);
  assert.equal(await runJs(w, `document.querySelector('.document-tab.active .tab-name').textContent`), '当前.md');
  results.push({ scenario: 'delayed-office-and-late-explicit-open', errors: state.errors }); w.destroy();
  await fs.writeFile(path.join(out, packaged ? 'packaged-results.json' : 'results.json'), JSON.stringify({ passed: true, packaged, results }, null, 2));
  console.log(JSON.stringify({ passed: true, packaged, scenarios: results.length, screenshots: out }));
  app.quit();
}).catch(async error => { console.error(error); await fs.mkdir(out, { recursive: true }); await fs.writeFile(path.join(out, 'failure.txt'), error.stack); for (const w of BrowserWindow.getAllWindows()) w.destroy(); app.exit(1); });
