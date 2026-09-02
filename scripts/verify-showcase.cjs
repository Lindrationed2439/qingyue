// Check documentation links, public download paths, and final asset integrity.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const MarkdownIt = require('markdown-it');
const root = path.resolve(__dirname, '..');
const docs = ['README.md','README.en.md','docs/PROMOTION.zh-CN.md','docs/media/README.md'];
const md = new MarkdownIt({html:true});
const catalog = JSON.parse(fs.readFileSync(path.join(root,'releases/catalog.json'),'utf8'));
const downloads = new Set(catalog.releases.flatMap(r => r.assets.map(a => `https://github.com/${catalog.repository}/releases/download/${r.tag}/${a.filename}`)));
let localLinks = 0;
let downloadLinks = 0;
for (const file of docs) {
  const source = fs.readFileSync(path.join(root,file),'utf8');
  assert.equal((source.match(/<details>/g)||[]).length,(source.match(/<\/details>/g)||[]).length,`${file}: unbalanced details`);
  const visit = tokens => {
    for (const token of tokens) {
      const destination = token.attrGet('src') || token.attrGet('href');
      if (destination) {
        if (/^https?:/i.test(destination)) {
          if (destination.includes('/releases/download/')) { assert.ok(downloads.has(destination),`Unknown download: ${destination}`); downloadLinks++; }
        } else if (!destination.startsWith('#')) {
          const local = path.resolve(root,path.dirname(file),decodeURIComponent(destination.split('#')[0]));
          assert.ok(local.startsWith(root+path.sep),`Link escapes repository: ${destination}`);
          assert.ok(fs.existsSync(local),`Broken link in ${file}: ${destination}`);
          localLinks++;
        }
      }
      if (token.children) visit(token.children);
    }
  };
  visit(md.parse(source,{}));
}
const media = path.join(root,'docs/media');
const manifest = JSON.parse(fs.readFileSync(path.join(media,'manifest.json'),'utf8'));
assert.deepEqual(manifest.validation.errors,[]);
for (const asset of manifest.files) {
  const content = fs.readFileSync(path.join(media,asset.file));
  assert.equal(content.length,asset.bytes);
  assert.equal(crypto.createHash('sha256').update(content).digest('hex'),asset.sha256);
  if (asset.file.endsWith('.png')) {
    const shot = manifest.screenshots.find(item=>item.file===asset.file);
    assert.equal(content.readUInt32BE(16),shot.width);
    assert.equal(content.readUInt32BE(20),shot.height);
  } else {
    assert.match(content.subarray(0,6).toString(),/^GIF8[79]a$/);
    assert.equal(content.readUInt16LE(6),manifest.demo.dimensions[0]);
    assert.equal(content.readUInt16LE(8),manifest.demo.dimensions[1]);
    assert.ok(asset.bytes < 2*1024*1024,'Keep the homepage demo below 2 MiB.');
  }
}
console.log(JSON.stringify({passed:true,documents:docs.length,localLinks,downloadLinks,screenshots:manifest.screenshots.length,
  gifFrames:manifest.demo.encodedFrames,gifDurationMs:manifest.demo.durationMs,assetBytes:manifest.files.reduce((sum,file)=>sum+file.bytes,0)},null,2));
