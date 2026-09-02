// Capture the released frontend unchanged, with public fixtures and an isolated profile.
// File reads and folder trees use real local fixtures. No personal files, registry writes,
// external requests, fake DOM content, or application saves are permitted by this harness.
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const fixtures = path.join(root, 'examples', '演示文档');
const output = path.join(root, 'docs', 'media');
const temporary = path.join(root, 'release', '.github-media', String(Date.now()));
const frames = [];
const screenshots = [];
const states = new Map();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const artifact = edition => path.resolve(process.env[edition === 'lite' ? 'QINGYUE_LITE_ASAR' : 'QINGYUE_FULL_ASAR'] || path.join(root, 'release', edition === 'lite' ? 'lite' : 'v1.3.3-build', 'win-unpacked', 'resources', 'app.asar'));
app.setPath('userData', path.join(temporary, 'profile'));
app.on('window-all-closed', () => {});
function fixturePath(value) {
  const resolved = path.resolve(typeof value === 'string' ? value : value.path);
  if (resolved !== fixtures && !resolved.startsWith(fixtures + path.sep)) throw new Error('Only public demo fixtures may be accessed.');
  return resolved;
}
async function readFixture(value) {
  const resolved = fixturePath(value);
  const stats = await fs.stat(resolved);
  return { path: resolved, name: path.basename(resolved), content: await fs.readFile(resolved, 'utf8'), encoding: 'utf8', size: stats.size, modifiedAt: stats.mtimeMs };
}
for (const [channel, handler] of Object.entries({
  'app:take-startup-files': e => states.get(e.sender.id).initial,
  'app:renderer-ready': () => [],
  'session:load': () => null, 'session:save': () => true,
  'session:archive': () => false, 'session:archived': () => null,
  'history:save': () => true, 'history:list': () => [],
  'file:read': (_e, value) => readFixture(value),
  'file:stat': async (_e, value) => { const stats = await fs.stat(fixturePath(value)); return { modifiedAt: stats.mtimeMs, size: stats.size }; },
  'dialog:open-folder': () => fixtures,
  'workspace:tree': (e, value) => require(path.join(artifact(states.get(e.sender.id).edition), 'electron', 'workspace.cjs')).walk(fixturePath(value)),
  'registry:status': () => ({ registered: false }),
  'app:info': e => ({ version: states.get(e.sender.id).edition === 'lite' ? '0.1.1' : '1.3.3', packaged: true, portable: true }),
  'window:get-fullscreen': e => BrowserWindow.fromWebContents(e.sender).isFullScreen(),
  'window:set-fullscreen': (e, enabled) => { const w = BrowserWindow.fromWebContents(e.sender); w.setFullScreen(enabled); e.sender.send('window:fullscreen-changed', enabled); return enabled; },
})) ipcMain.handle(channel, handler);

const js = (w, code) => w.webContents.executeJavaScript(code, true);
async function until(w, expression, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { if (await js(w, expression)) return; await pause(100); }
  const state = await js(w, `({ready:document.querySelector('.app-shell')?.dataset.ready,title:document.querySelector('#preview h1')?.textContent,tabs:[...document.querySelectorAll('.tab-name')].map(n=>n.textContent),toasts:document.querySelector('#toast-region')?.textContent})`);
  throw new Error(`Timed out: ${expression}; ${JSON.stringify(state)}; ${JSON.stringify(states.get(w.webContents.id).errors)}`);
}
async function click(w, selector) {
  await js(w, `(() => { const button = document.querySelector(${JSON.stringify(selector)}); if (!button || button.disabled) throw new Error('Control unavailable'); button.click(); })()`);
  await pause(300);
}
async function theme(w, value) {
  await click(w, '#settings-button');
  await js(w, `(() => { const select = document.querySelector('#theme-select'); select.value=${JSON.stringify(value)}; select.dispatchEvent(new Event('change', {bubbles:true})); })()`);
  await click(w, '#settings-close');
  await until(w, `document.querySelector('.app-shell').dataset.theme === ${JSON.stringify(value)}`);
  await until(w, `document.querySelectorAll('.mermaid-diagram svg').length === 1`);
}
async function shot(w, name, purpose) {
  await pause(400);
  const image = (await w.capturePage()).resize({width:1440,quality:'best'});
  assert.equal(image.getSize().width, 1440);
  await fs.writeFile(path.join(output, name), image.toPNG());
  screenshots.push({ file: name, edition: states.get(w.webContents.id).edition, purpose, ...image.getSize() });
  console.log(JSON.stringify({ screenshot: name }));
}
async function frame(w, delayMs, action) {
  const file = `${String(frames.length).padStart(3, '0')}.png`;
  await fs.writeFile(path.join(temporary, file), (await w.capturePage()).resize({width:1440,quality:'best'}).toPNG());
  frames.push({ file, delayMs, action });
}
async function boot(edition) {
  const packageInfo = JSON.parse(await fs.readFile(path.join(artifact(edition), 'package.json'), 'utf8'));
  assert.equal(packageInfo.version, edition === 'lite' ? '0.1.1' : '1.3.3');
  const state = { edition, initial: [], errors: [], blockedExternalRequests: 0 };
  const w = new BrowserWindow({ width: 1440, height: 930, useContentSize: true, show: false, webPreferences: {
    preload: path.join(artifact(edition), 'electron', 'preload.cjs'), sandbox: true, contextIsolation: true,
    nodeIntegration: false, offscreen: true, backgroundThrottling: false, partition: `showcase-${edition}-${Date.now()}`,
  } });
  states.set(w.webContents.id, state);
  w.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']}, (_details, callback) => { state.blockedExternalRequests++; callback({cancel:true}); });
  w.webContents.on('console-message', (_e, level, message) => { if (level >= 3 && !message.includes('Electron Security Warning')) state.errors.push(message); });
  const location = path.join(artifact(edition), 'dist', 'index.html');
  await w.loadFile(location);
  await until(w, `document.querySelector('.app-shell')?.dataset.ready === 'true'`);
  await js(w, `localStorage.setItem('qingyue-startup-settings', JSON.stringify({startupMode:'empty',defaultView:'split',rememberFolder:false}));localStorage.setItem('qingyue-theme','light');localStorage.setItem('qingyue-font-size','16');`);
  state.initial = ['待办清单.md', '示例配置.json', '阅读体验.md'].map(name => path.join(fixtures, name));
  await w.loadFile(location);
  await until(w, `document.querySelector('.app-shell')?.dataset.ready === 'true' && document.querySelector('#preview h1')?.textContent.includes('把文档读清楚')`);
  await until(w, `document.querySelectorAll('.mermaid-diagram svg').length === 1`);
  await until(w, `document.querySelectorAll('#toast-region .toast').length === 0`);
  await js(w, `document.activeElement?.blur()`);
  return {w, state};
}
app.whenReady().then(async () => {
  await fs.mkdir(output, {recursive:true}); await fs.mkdir(temporary, {recursive:true});
  const {w, state} = await boot('full');
  await click(w, '#project-button'); await click(w, '#open-folder-button');
  await until(w, `document.querySelectorAll('.tree-item').length === 4`);
  await shot(w, 'split-view.png', 'Light theme, real folder tree, three tabs, Markdown editor and live preview');
  await frame(w, 2400, 'Split view with the public demo project');
  // Insert a Markdown quote through Chromium input, then capture its live preview.
  await js(w, `document.querySelector('.monaco-editor textarea').focus()`);
  w.webContents.debugger.attach('1.3');
  await w.webContents.debugger.sendCommand('Input.dispatchKeyEvent', {type:'keyDown',key:'Home',code:'Home',windowsVirtualKeyCode:36,modifiers:2});
  await w.webContents.debugger.sendCommand('Input.dispatchKeyEvent', {type:'keyUp',key:'Home',code:'Home',windowsVirtualKeyCode:36,modifiers:2});
  for (const text of ['> ', '边写边看，', '思路更清晰。', '\n\n']) {
    await w.webContents.debugger.sendCommand('Input.insertText', {text});
    await pause(450); await frame(w, 450, 'Typing a Markdown quote; the preview updates');
  }
  w.webContents.debugger.detach();
  await until(w, `document.querySelector('#preview').textContent.includes('边写边看，思路更清晰。')`);
  await frame(w, 1500, 'The inserted quote is visible in the preview');
  await click(w, '#project-close'); await click(w, '[data-mode="preview"]');
  await click(w, '#outline-button');
  await frame(w, 2300, 'Switch to reading mode and open the non-overlapping outline');
  // Capture the clean sample in a second, unedited tab by reopening a fresh window below.
  await click(w, '.outline-link[data-line]:nth-child(4)');
  await pause(650); await frame(w, 2100, 'Use the outline to navigate to code');
  await click(w, '#zoom-in'); await frame(w, 900, 'Zoom to 110%');
  await click(w, '#zoom-in'); await frame(w, 1400, 'Zoom to 120%');
  await theme(w, 'dark'); await frame(w, 2200, 'Switch to the built-in dark theme');
  await click(w, '.outline-link:nth-child(6)'); await pause(650); await frame(w, 1600, 'Navigate to reading tips');
  await theme(w, 'light'); await click(w, '.outline-link:first-child');
  await click(w, '#zoom-out'); await click(w, '#zoom-out');
  await pause(500); await frame(w, 1400, 'Return to the light reading theme');
  assert.deepEqual(state.errors, []);
  w.destroy();

  const clean = await boot('full');
  await click(clean.w, '[data-mode="preview"]'); await click(clean.w, '#outline-button');
  await shot(clean.w, 'reading-outline.png', 'Reading mode with a left outline and unobstructed text');
  await theme(clean.w, 'dark'); await click(clean.w, '.outline-link:nth-child(5)'); await pause(600);
  await shot(clean.w, 'dark-mode.png', 'Dark reading theme, a real Mermaid diagram and reading tips');
  assert.deepEqual(clean.state.errors, []); clean.w.destroy();
  const lite = await boot('lite');
  await click(lite.w, '[data-mode="preview"]'); await click(lite.w, '#outline-button'); await theme(lite.w, 'paper');
  await shot(lite.w, 'lite-reading.png', 'Lite 0.1.1 in the paper reading theme');
  assert.deepEqual(lite.state.errors, []); lite.w.destroy();
  const manifest = { source:'Unmodified released app.asar frontend and preload', versions:{full:'1.3.3',lite:'0.1.1'}, fixtureDirectory:'examples/演示文档', screenshots, frames,
    playback:'Interaction pauses shortened; this is not a startup-speed benchmark.',
    validation:{ errors:[...state.errors,...clean.state.errors,...lite.state.errors], blockedExternalRequests:state.blockedExternalRequests+clean.state.blockedExternalRequests+lite.state.blockedExternalRequests },
  };
  await fs.writeFile(path.join(temporary, 'capture.json'), JSON.stringify(manifest,null,2));
  await fs.writeFile(path.join(root,'release','.github-media','latest.json'), JSON.stringify({directory:temporary},null,2));
  console.log(JSON.stringify({passed:true,screenshots:screenshots.length,frames:frames.length,temporary}));
  app.quit();
}).catch(error => {console.error(error);for(const w of BrowserWindow.getAllWindows())w.destroy();app.exit(1);});
