const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const ExcelJS = require('exceljs');
const { parseExcelInput, readDocx, writeDocx, readXlsx, writeXlsx, searchOffice } = require('../electron/office.cjs');

test('Word lightweight writer produces a readable DOCX', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qingyue-word-'));
  const target = path.join(directory, 'sample.docx');
  await writeDocx(target, [
    { type: 'heading', level: 1, runs: [{ text: '轻阅测试标题', bold: true }] },
    { type: 'paragraph', runs: [{ text: '正文内容' }] },
    { type: 'bullet', runs: [{ text: '列表项目' }] },
  ]);
  const reopened = await readDocx(target);
  assert.match(reopened.html, /轻阅测试标题/);
  assert.match(reopened.html, /正文内容/);
  assert.ok(reopened.size > 5000);
});

test('Excel lightweight reader and writer preserve sheets and apply edits', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qingyue-excel-'));
  const source = path.join(directory, 'source.xlsx');
  const target = path.join(directory, 'copy.xlsx');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('预算');
  sheet.addRow(['项目', '金额']);
  sheet.addRow(['设计', 1200]);
  await workbook.xlsx.writeFile(source);
  const opened = await readXlsx(source);
  assert.equal(opened.sheets[0].rows[1][1].value, '1200');
  await writeXlsx(target, source, [{ sheetName: '预算', row: 2, column: 2, value: '1688' }]);
  const reopened = await readXlsx(target);
  assert.equal(reopened.sheets[0].rows[1][1].value, '1688');
});

test('Excel input conversion keeps formulas and typed values', () => {
  assert.deepEqual(parseExcelInput('=SUM(A1:A3)'), { formula: 'SUM(A1:A3)' });
  assert.equal(parseExcelInput('42.5'), 42.5);
  assert.equal(parseExcelInput('TRUE'), true);
  assert.equal(parseExcelInput('文字'), '文字');
});

test('Office search indexes Word paragraphs and Excel cells', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qingyue-office-search-'));
  const docxPath = path.join(directory, 'notes.docx');
  await writeDocx(docxPath, [{ type: 'paragraph', runs: [{ text: '项目关键字在这里' }] }]);
  assert.equal((await searchOffice(docxPath, '关键字'))[0].officeKind, 'docx');
  const xlsxPath = path.join(directory, 'data.xlsx');
  const workbook = new ExcelJS.Workbook(); workbook.addWorksheet('数据').getCell('B3').value = '关键字'; await workbook.xlsx.writeFile(xlsxPath);
  const result = (await searchOffice(xlsxPath, '关键字'))[0];
  assert.equal(result.sheetName, '数据'); assert.equal(result.row, 3); assert.equal(result.cellColumn, 2);
});
