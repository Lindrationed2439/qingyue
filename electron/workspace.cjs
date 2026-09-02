const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const iconv = require('iconv-lite');
const { isSupported } = require('./file-types.cjs');

const MAX_TREE_ITEMS = 5000;
const MAX_SEARCH_FILE = 2 * 1024 * 1024;

function decodeWorkspace(buffer) {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) return { text: buffer.subarray(3).toString('utf8'), encoding: 'utf8-bom' };
  if (buffer.subarray(0, 2).equals(Buffer.from([0xff, 0xfe]))) return { text: iconv.decode(buffer.subarray(2), 'utf16-le'), encoding: 'utf16-le' };
  try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(buffer), encoding: 'utf8' }; }
  catch { return { text: iconv.decode(buffer, 'gb18030'), encoding: 'gb18030' }; }
}

function encodeWorkspace(text, encoding) {
  if (encoding === 'utf8-bom') return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text)]);
  if (encoding === 'utf16-le') return Buffer.concat([Buffer.from([0xff, 0xfe]), iconv.encode(text, 'utf16-le')]);
  if (encoding === 'gb18030') return iconv.encode(text, 'gb18030');
  return Buffer.from(text);
}

async function atomicJson(filePath, value) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  await fsp.writeFile(temporary, JSON.stringify(value), 'utf8');
  await fsp.rename(temporary, filePath);
}

function sessionFile(userData) {
  return path.join(userData, 'recovery', 'session.json');
}

async function saveSession(userData, payload) {
  const safe = JSON.stringify(payload);
  if (Buffer.byteLength(safe) > 20 * 1024 * 1024) throw new Error('恢复数据超过 20 MB，请先保存大型文件。');
  await atomicJson(sessionFile(userData), payload);
  return true;
}

async function loadSession(userData) {
  try { return JSON.parse(await fsp.readFile(sessionFile(userData), 'utf8')); } catch { return null; }
}

async function archiveSession(userData) {
  const previous = await loadSession(userData);
  // A fresh/empty launch must not destroy the last useful recovery snapshot.
  if (!previous?.tabs?.some((tab) => tab.path || tab.dirty || tab.content)) return false;
  await atomicJson(path.join(userData, 'recovery', 'previous-session.json'), previous);
  return true;
}

async function loadArchivedSession(userData) {
  try { return JSON.parse(await fsp.readFile(path.join(userData, 'recovery', 'previous-session.json'), 'utf8')); }
  catch { return null; }
}

function historyDirectory(userData, identity) {
  const key = crypto.createHash('sha1').update(identity).digest('hex');
  return path.join(userData, 'history', key);
}

async function saveHistory(userData, snapshot) {
  if (!snapshot?.identity || typeof snapshot.content !== 'string') return false;
  if (Buffer.byteLength(snapshot.content) > 5 * 1024 * 1024) return false;
  const directory = historyDirectory(userData, snapshot.identity);
  await fsp.mkdir(directory, { recursive: true });
  const timestamp = Date.now();
  await atomicJson(path.join(directory, `${timestamp}.json`), {
    timestamp, identity: snapshot.identity, name: snapshot.name, content: snapshot.content,
  });
  const files = (await fsp.readdir(directory)).filter((name) => name.endsWith('.json')).sort().reverse();
  await Promise.all(files.slice(30).map((name) => fsp.unlink(path.join(directory, name)).catch(() => undefined)));
  return true;
}

async function listHistory(userData, identity) {
  const directory = historyDirectory(userData, identity);
  try {
    const files = (await fsp.readdir(directory)).filter((name) => name.endsWith('.json')).sort().reverse();
    return Promise.all(files.map(async (name) => {
      const value = JSON.parse(await fsp.readFile(path.join(directory, name), 'utf8'));
      return { timestamp: value.timestamp, name: value.name, file: name };
    }));
  } catch { return []; }
}

async function readHistory(userData, identity, file) {
  if (!/^\d+\.json$/.test(file)) throw new Error('历史版本标识无效。');
  return JSON.parse(await fsp.readFile(path.join(historyDirectory(userData, identity), file), 'utf8'));
}

async function walk(root, maxItems = MAX_TREE_ITEMS) {
  const result = [];
  async function visit(directory, depth) {
    if (result.length >= maxItems || depth > 20) return;
    let entries = await fsp.readdir(directory, { withFileTypes: true });
    entries = entries.filter((entry) => !['.git', 'node_modules', '.qingyue-backup'].includes(entry.name));
    entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name, 'zh-CN'));
    for (const entry of entries) {
      if (result.length >= maxItems) break;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        result.push({ type: 'directory', name: entry.name, path: fullPath, relative: path.relative(root, fullPath), depth });
        await visit(fullPath, depth + 1);
      } else if (entry.isFile() && isSupported(entry.name)) {
        result.push({ type: 'file', name: entry.name, path: fullPath, relative: path.relative(root, fullPath), depth });
      }
    }
  }
  await visit(root, 0);
  return { root, items: result, truncated: result.length >= maxItems };
}

async function searchableFiles(root) {
  const tree = await walk(root, 10000);
  return tree.items.filter((item) => item.type === 'file');
}

function isOfficeFile(file) {
  return ['.docx', '.xlsx'].includes(path.extname(file.name).toLowerCase());
}

async function searchFolder(root, query, matchCase = false, searchOffice) {
  if (!query) return [];
  const needle = matchCase ? query : query.toLocaleLowerCase();
  const results = [];
  for (const file of await searchableFiles(root)) {
    if (results.length >= 500) break;
    try {
      const nameSource = matchCase ? file.name : file.name.toLocaleLowerCase();
      const nameColumn = nameSource.indexOf(needle);
      if (nameColumn >= 0) results.push({ path: file.path, relative: file.relative, line: 1, column: nameColumn + 1, preview: '文件名匹配', matchKind: 'filename' });
      if (results.length >= 500) break;
      if (isOfficeFile(file)) {
        if (searchOffice) {
          const officeMatches = await searchOffice(file.path, query, matchCase, Math.min(100, 500 - results.length));
          results.push(...officeMatches.map((match) => ({ ...match, path: file.path, relative: file.relative, matchKind: 'office' })));
        }
        continue;
      }
      const stats = await fsp.stat(file.path);
      if (stats.size > MAX_SEARCH_FILE) continue;
      const { text } = decodeWorkspace(await fsp.readFile(file.path));
      const lines = text.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (results.length >= 500) return;
        const haystack = matchCase ? line : line.toLocaleLowerCase();
        const column = haystack.indexOf(needle);
        if (column >= 0) results.push({ path: file.path, relative: file.relative, line: index + 1, column: column + 1, preview: line.trim().slice(0, 240), matchKind: 'text' });
      });
    } catch { /* unreadable files are skipped */ }
  }
  return results;
}

async function replaceFolder(root, search, replacement, matchCase = false) {
  if (!search) throw new Error('查找内容不能为空。');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupRoot = path.join(root, '.qingyue-backup', timestamp);
  const changed = [];
  for (const file of (await searchableFiles(root)).filter((item) => !isOfficeFile(item))) {
    try {
      const stats = await fsp.stat(file.path);
      if (stats.size > MAX_SEARCH_FILE) continue;
      const decoded = decodeWorkspace(await fsp.readFile(file.path));
      const source = decoded.text;
      const expression = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi');
      const next = source.replace(expression, replacement);
      if (next === source) continue;
      const backup = path.join(backupRoot, file.relative);
      await fsp.mkdir(path.dirname(backup), { recursive: true });
      await fsp.copyFile(file.path, backup);
      await fsp.writeFile(file.path, encodeWorkspace(next, decoded.encoding));
      changed.push(file.path);
    } catch { /* keep processing other files */ }
  }
  return { changed, backupRoot: changed.length ? backupRoot : null };
}

module.exports = { saveSession, loadSession, archiveSession, loadArchivedSession, saveHistory, listHistory, readHistory, walk, searchFolder, replaceFolder };
