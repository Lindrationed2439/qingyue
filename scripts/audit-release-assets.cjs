// Read-only inspection of release files. Temporary extracted archives stay under release/.github-audit.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const builderRequire = createRequire(require.resolve('electron-builder'));
const asarRequire = createRequire(builderRequire.resolve('app-builder-lib'));
const asar = asarRequire('@electron/asar');
const pnpmStore = path.join(root, 'node_modules', '.pnpm');
const installer = fs.readdirSync(pnpmStore).find(name => name.startsWith('electron-winstaller@'));
const seven = process.env.QINGYUE_7ZIP || (installer && path.join(pnpmStore, installer, 'node_modules', 'electron-winstaller', 'vendor', '7z-x64.exe'));
if (!seven || !fs.existsSync(seven)) throw new Error('Set QINGYUE_7ZIP to a local 7-Zip executable with NSIS support.');
const release = path.join(root, 'release');
const output = path.join(release, '.github-audit');
fs.mkdirSync(output, { recursive: true });
const catalog = [];
const run = (...args) => execFileSync(seven, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
function entries(file) {
  return run('l', '-slt', file).split('----------').slice(1).join('----------').split(/\r?\n\r?\n/).map(block => {
    const values = Object.fromEntries(block.split(/\r?\n/).filter(line => line.includes(' = ')).map(line => { const i = line.indexOf(' = '); return [line.slice(0, i), line.slice(i + 3)]; }));
    return { path: values.Path, size: Number(values.Size || 0), folder: values.Folder === '+' || /^[D]/.test(values.Attributes || '') };
  }).filter(item => item.path);
}
const privatePath = /(^|[\\/])(QingYue(?:Lite)?-Data|recovery|history|Local Storage|Session Storage|Cookies|\.env)([\\/]|$)/i;
const hash = file => new Promise((resolve, reject) => { const digest = crypto.createHash('sha256'); fs.createReadStream(file).on('data', chunk => digest.update(chunk)).on('end', () => resolve(digest.digest('hex'))).on('error', reject); });
(async () => {
  for (const name of fs.readdirSync(release).filter(name => /^QingYue-.*\.(exe|zip)$/.test(name)).sort()) {
    const file = path.join(release, name);
    const scratch = path.join(output, path.basename(name, path.extname(name)) + path.extname(name).replace('.', '-'));
    fs.mkdirSync(scratch, { recursive: true });
    let archive = file;
    if (name.endsWith('.exe')) {
      const payload = entries(file).find(item => /app-64\.7z$/.test(item.path));
      if (!payload) throw new Error(`No portable payload: ${name}`);
      run('e', '-y', `-o${scratch}`, file, payload.path);
      archive = path.join(scratch, 'app-64.7z');
    }
    const listing = entries(archive);
    const privateFiles = listing.filter(item => privatePath.test(item.path) && !item.folder);
    if (privateFiles.length) throw new Error(`Private data in ${name}: ${privateFiles.map(item => item.path).join(', ')}`);
    const appEntry = listing.find(item => /(^|[\\/])resources[\\/]app\.asar$/.test(item.path));
    if (!appEntry) throw new Error(`No app.asar: ${name}`);
    run('e', '-y', `-o${scratch}`, archive, appEntry.path);
    const appArchive = path.join(scratch, 'app.asar');
    const appFiles = asar.listPackage(appArchive);
    const privateAppFiles = appFiles.filter(name => !/^[/\\]node_modules[/\\]/.test(name) && privatePath.test(name));
    if (privateAppFiles.length) throw new Error(`Private data inside app.asar: ${name}`);
    const metadata = JSON.parse(asar.extractFile(appArchive, 'package.json').toString());
    const extras = appFiles.filter(name => /^[/\\]dist[/\\][^/\\]+$/.test(name) && !name.endsWith('index.html') && !name.endsWith('assets'));
    const row = { filename: name, version: metadata.version, edition: metadata.qingyueEdition === 'lite' ? 'lite' : 'full', size: fs.statSync(file).size, sha256: await hash(file), entries: listing.length, extraDistFiles: extras };
    catalog.push(row); console.log(JSON.stringify(row));
    // Only remove the two exact generated extraction files, never a release or user directory.
    for (const temp of [appArchive, path.join(scratch, 'app-64.7z')]) if (path.dirname(temp) === scratch && fs.existsSync(temp)) fs.unlinkSync(temp);
  }
  fs.writeFileSync(path.join(output, 'catalog.json'), JSON.stringify(catalog, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
