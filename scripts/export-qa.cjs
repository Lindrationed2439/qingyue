const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { writeDocx } = require('../electron/office.cjs');

const root = path.join(__dirname, '..', 'qa', 'exports');
const htmlPath = path.join(root, 'markdown-export-sample.html');
const pdfPath = path.join(root, 'markdown-export-sample.pdf');
const docxPath = path.join(root, 'markdown-export-sample.docx');

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
@page{size:A4;margin:16mm}body{margin:0;color:#1f2329;font:15px/1.8 "Segoe UI","Microsoft YaHei",sans-serif}.document{max-width:820px;margin:auto}h1{font-size:30px;border-bottom:1px solid #dfe1e5;padding-bottom:12px}h2{margin-top:34px;color:#3370ff}blockquote{margin-left:0;padding:10px 16px;border-left:4px solid #6594ff;background:#f4f7ff}table{width:100%;border-collapse:collapse}th,td{border:1px solid #dfe1e5;padding:8px 12px}th{background:#f2f4f7}pre{padding:16px;background:#f6f7f9;border-radius:8px}svg{max-width:100%}
</style></head><body><article class="document"><h1>轻阅 Markdown 导出验收</h1><p>这是一份用于检查中文、强调、列表、表格、代码与图表版式的内部样稿。</p><h2>核心能力</h2><ul><li><b>整洁阅读：</b>主题、字号与行宽会带入导出。</li><li><b>离线安全：</b>文件始终保留在本机。</li></ul><blockquote>自动恢复和历史版本可以降低断电或误关闭造成的内容损失。</blockquote><h2>数据表格</h2><table><thead><tr><th>功能</th><th>状态</th><th>说明</th></tr></thead><tbody><tr><td>PDF</td><td>可用</td><td>保留阅读版式</td></tr><tr><td>DOCX</td><td>可用</td><td>可继续编辑</td></tr></tbody></table><h2>代码与 Mermaid</h2><pre><code>const app = 'QingYue';\nconsole.log(app);</code></pre><svg viewBox="0 0 640 130" role="img" aria-label="Mermaid 图表示意"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#6594ff"/></marker></defs><rect x="40" y="30" width="180" height="62" rx="12" fill="#eef3ff" stroke="#6594ff"/><rect x="420" y="30" width="180" height="62" rx="12" fill="#eef3ff" stroke="#6594ff"/><text x="130" y="68" text-anchor="middle" font-size="18">Markdown</text><text x="510" y="68" text-anchor="middle" font-size="18">PDF / HTML / DOCX</text><path d="M220 61 L415 61" stroke="#6594ff" stroke-width="3" marker-end="url(#arrow)"/></svg></article></body></html>`;

const blocks = [
  { type: 'heading', level: 1, runs: [{ text: '轻阅 Markdown 导出验收' }] },
  { type: 'paragraph', runs: [{ text: '这是一份用于检查中文、强调、列表、表格、代码与图表版式的内部样稿。' }] },
  { type: 'heading', level: 2, runs: [{ text: '核心能力' }] },
  { type: 'bullet', level: 0, runs: [{ text: '整洁阅读：', bold: true }, { text: '主题、字号与行宽会带入导出。' }] },
  { type: 'bullet', level: 0, runs: [{ text: '离线安全：', bold: true }, { text: '文件始终保留在本机。' }] },
  { type: 'paragraph', runs: [{ text: '自动恢复和历史版本可以降低断电或误关闭造成的内容损失。', italic: true }] },
  { type: 'heading', level: 2, runs: [{ text: '数据表格' }] },
  { type: 'table', rows: [
    [{ runs: [{ text: '功能' }] }, { runs: [{ text: '状态' }] }, { runs: [{ text: '说明' }] }],
    [{ runs: [{ text: 'PDF' }] }, { runs: [{ text: '可用' }] }, { runs: [{ text: '保留阅读版式' }] }],
    [{ runs: [{ text: 'DOCX' }] }, { runs: [{ text: '可用' }] }, { runs: [{ text: '可继续编辑' }] }],
  ] },
  { type: 'heading', level: 2, runs: [{ text: '代码与 Mermaid' }] },
  { type: 'paragraph', runs: [{ text: "const app = 'QingYue';\nconsole.log(app);" }] },
  { type: 'paragraph', runs: [{ text: 'Mermaid 图表\ngraph LR\n  Markdown --> PDF_HTML_DOCX' }] },
];

app.whenReady().then(async () => {
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(htmlPath, html, 'utf8');
  await writeDocx(docxPath, blocks);
  const printWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  try {
    await printWindow.loadFile(htmlPath);
    const buffer = await printWindow.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { top: .5, bottom: .5, left: .55, right: .55 } });
    await fs.writeFile(pdfPath, buffer);
  } finally {
    printWindow.destroy();
  }
  const sizes = await Promise.all([htmlPath, pdfPath, docxPath].map(async (file) => ({ file, size: (await fs.stat(file)).size })));
  console.log(JSON.stringify(sizes, null, 2));
  app.quit();
}).catch((error) => { console.error(error); process.exitCode = 1; app.quit(); });
