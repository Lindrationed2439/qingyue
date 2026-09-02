const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { saveSession, loadSession, saveHistory, listHistory, readHistory, walk, searchFolder, replaceFolder } = require('../electron/workspace.cjs');

test('session and history survive round trips', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qingyue-session-'));
  const session = { activeTabId: 'one', tabs: [{ id: 'one', name: 'notes.md', content: '# 草稿' }] };
  await saveSession(root, session);
  assert.deepEqual(await loadSession(root), session);
  await saveHistory(root, { identity: 'notes.md', name: 'notes.md', content: '# 第一版' });
  const items = await listHistory(root, 'notes.md');
  assert.equal(items.length, 1);
  assert.equal((await readHistory(root, 'notes.md', items[0].file)).content, '# 第一版');
});

test('folder tree, search and backup-first replacement work together', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qingyue-project-'));
  await fs.mkdir(path.join(root, 'docs'));
  await fs.writeFile(path.join(root, 'docs', 'a.md'), '# 旧名称\n这里也有旧名称', 'utf8');
  await fs.writeFile(path.join(root, 'ignore.bin'), Buffer.from([0, 1, 2]));
  const tree = await walk(root);
  assert.ok(tree.items.some((item) => item.relative === path.join('docs', 'a.md')));
  assert.equal((await searchFolder(root, '旧名称')).length, 2);
  const result = await replaceFolder(root, '旧名称', '新名称');
  assert.equal(result.changed.length, 1);
  assert.match(await fs.readFile(path.join(root, 'docs', 'a.md'), 'utf8'), /新名称/);
  assert.equal(await fs.readFile(path.join(result.backupRoot, 'docs', 'a.md'), 'utf8'), '# 旧名称\n这里也有旧名称');
});

test('folder search includes Office names and delegates Office content extraction', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qingyue-project-office-'));
  await fs.writeFile(path.join(root, '会议关键字.docx'), 'placeholder');
  const calls = [];
  const results = await searchFolder(root, '关键字', false, async (filePath) => {
    calls.push(filePath); return [{ officeKind: 'docx', line: 2, column: 1, preview: '正文关键字' }];
  });
  assert.equal(calls.length, 1);
  assert.ok(results.some((item) => item.matchKind === 'filename'));
  assert.ok(results.some((item) => item.matchKind === 'office'));
});
