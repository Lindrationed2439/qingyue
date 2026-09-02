const fsp = require('node:fs/promises');
const path = require('node:path');
const mammoth = require('mammoth');
const ExcelJS = require('exceljs');
const {
  AlignmentType, Document, HeadingLevel, LevelFormat, Packer, Paragraph,
  ShadingType, Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType,
} = require('docx');

const WORD_FONT = 'Microsoft YaHei';
const A4_CONTENT_WIDTH = 9026;

function officeStats(resolved, stats) {
  return { path: resolved, name: path.basename(resolved), size: stats.size, modifiedAt: stats.mtimeMs };
}

function wordRuns(runs = []) {
  const safeRuns = runs.length ? runs : [{ text: '' }];
  return safeRuns.map((run) => new TextRun({
    text: String(run.text || ''), bold: Boolean(run.bold), italics: Boolean(run.italic),
    underline: run.underline ? {} : undefined, break: run.break ? 1 : undefined,
  }));
}

function buildWordDocument(blocks = []) {
  const children = [];
  for (const block of blocks) {
    if (block.type === 'table') {
      const columnCount = Math.max(1, ...(block.rows || []).map((row) => row.length));
      const baseWidth = Math.floor(A4_CONTENT_WIDTH / columnCount);
      const columnWidths = Array.from({ length: columnCount }, (_unused, index) => index === columnCount - 1 ? A4_CONTENT_WIDTH - baseWidth * (columnCount - 1) : baseWidth);
      const rows = (block.rows || []).map((row, rowIndex) => new TableRow({
        children: Array.from({ length: columnCount }, (_unused, cellIndex) => {
          const cell = row[cellIndex] || { text: '' };
          const runs = (cell.runs || [{ text: cell.text || '' }]).map((run) => rowIndex === 0 ? { ...run, bold: true } : run);
          return new TableCell({
            width: { size: columnWidths[cellIndex], type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            shading: rowIndex === 0 ? { type: ShadingType.CLEAR, fill: 'F2F4F7', color: 'auto' } : undefined,
            children: [new Paragraph({ children: wordRuns(runs), spacing: { after: 0 } })],
          });
        }),
      }));
      if (rows.length) children.push(new Table({ rows, width: { size: A4_CONTENT_WIDTH, type: WidthType.DXA }, columnWidths, layout: TableLayoutType.FIXED }));
      continue;
    }
    const options = { children: wordRuns(block.runs) };
    if (block.type === 'heading') options.heading = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][Math.max(0, Math.min(2, (block.level || 1) - 1))];
    if (block.type === 'bullet') options.numbering = { reference: 'qingyue-bullets', level: Math.max(0, Math.min(3, block.level || 0)) };
    if (block.type === 'number') options.numbering = { reference: 'qingyue-numbering', level: Math.max(0, Math.min(3, block.level || 0)) };
    children.push(new Paragraph(options));
  }
  if (!children.length) children.push(new Paragraph(''));
  return new Document({
    styles: {
      default: {
        document: { run: { font: WORD_FONT, size: 22, color: '252A34' }, paragraph: { spacing: { after: 120, line: 276 } } },
      },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: WORD_FONT, size: 32, bold: true, color: '3370FF' }, paragraph: { spacing: { before: 320, after: 160 }, keepNext: true } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: WORD_FONT, size: 26, bold: true, color: '3370FF' }, paragraph: { spacing: { before: 240, after: 120 }, keepNext: true } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: WORD_FONT, size: 24, bold: true, color: '1F4D78' }, paragraph: { spacing: { before: 160, after: 80 }, keepNext: true } },
      ],
    },
    numbering: { config: [
      { reference: 'qingyue-numbering', levels: [0, 1, 2, 3].map((level) => ({
        level, format: LevelFormat.DECIMAL, text: `%${level + 1}.`, alignment: AlignmentType.START,
        style: { paragraph: { indent: { left: 720 + level * 360, hanging: 360 }, spacing: { after: 80, line: 276 } } },
      })) },
      { reference: 'qingyue-bullets', levels: ['•', '◦', '▪', '–'].map((text, level) => ({
        level, format: LevelFormat.BULLET, text, alignment: AlignmentType.START,
        style: { paragraph: { indent: { left: 720 + level * 360, hanging: 360 }, spacing: { after: 80, line: 276 } } },
      })) },
    ] },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 708, footer: 708 } } }, children }],
  });
}

function excelCellText(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().replace('T', ' ').slice(0, 19);
  if (typeof value === 'object') {
    if (value.formula) return `=${value.formula}`;
    if (value.richText) return value.richText.map((part) => part.text || '').join('');
    if (value.text !== undefined) return String(value.text);
    if (value.error) return String(value.error);
    if (value.result !== undefined) return String(value.result ?? '');
  }
  return String(value);
}

function parseExcelInput(value) {
  const text = String(value ?? '');
  if (!text.trim()) return null;
  if (text.startsWith('=')) return { formula: text.slice(1) };
  if (/^(true|false)$/i.test(text.trim())) return text.trim().toLowerCase() === 'true';
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(text.trim())) return Number(text.trim());
  return text;
}

async function readDocx(filePath) {
  const resolved = path.resolve(filePath);
  const stats = await fsp.stat(resolved);
  if (stats.size > 25 * 1024 * 1024) throw new Error('DOCX 超过 25 MB，轻量模式暂不打开。');
  const result = await mammoth.convertToHtml({ path: resolved }, { externalFileAccess: false, ignoreEmptyParagraphs: false });
  return { ...officeStats(resolved, stats), html: result.value, warnings: result.messages.map((message) => message.message) };
}

async function writeDocx(filePath, blocks) {
  const resolved = path.resolve(filePath);
  const buffer = await Packer.toBuffer(buildWordDocument(blocks));
  await fsp.writeFile(resolved, buffer);
  return officeStats(resolved, await fsp.stat(resolved));
}

async function readXlsx(filePath) {
  const resolved = path.resolve(filePath);
  const stats = await fsp.stat(resolved);
  if (stats.size > 25 * 1024 * 1024) throw new Error('XLSX 超过 25 MB，轻量模式暂不打开。');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(resolved);
  const sheets = workbook.worksheets.map((worksheet) => {
    const rowCount = Math.min(Math.max(worksheet.rowCount, 1), 500);
    const columnCount = Math.min(Math.max(worksheet.columnCount, 1), 100);
    const rows = [];
    for (let row = 1; row <= rowCount; row += 1) {
      const cells = [];
      for (let column = 1; column <= columnCount; column += 1) {
        const cell = worksheet.getCell(row, column);
        const fg = cell.fill?.fgColor?.argb;
        const color = cell.font?.color?.argb;
        cells.push({ value: excelCellText(cell.value), style: {
          bold: Boolean(cell.font?.bold), italic: Boolean(cell.font?.italic), align: cell.alignment?.horizontal || '',
          fill: fg && fg.length >= 6 ? `#${fg.slice(-6)}` : '', color: color && color.length >= 6 ? `#${color.slice(-6)}` : '',
        } });
      }
      rows.push(cells);
    }
    return {
      name: worksheet.name, rowCount, columnCount,
      truncated: worksheet.rowCount > rowCount || worksheet.columnCount > columnCount,
      widths: Array.from({ length: columnCount }, (_unused, index) => Math.min(36, Math.max(8, worksheet.getColumn(index + 1).width || 12))), rows,
    };
  });
  return { ...officeStats(resolved, stats), sheets };
}

async function writeXlsx(filePath, sourcePath, changes) {
  const source = path.resolve(sourcePath);
  const resolved = path.resolve(filePath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(source);
  for (const change of changes || []) {
    const worksheet = workbook.getWorksheet(change.sheetName);
    if (worksheet) worksheet.getCell(change.row, change.column).value = parseExcelInput(change.value);
  }
  workbook.calcProperties.fullCalcOnLoad = true;
  await workbook.xlsx.writeFile(resolved);
  return officeStats(resolved, await fsp.stat(resolved));
}

async function searchOffice(filePath, query, matchCase = false, limit = 100) {
  const resolved = path.resolve(filePath);
  const stats = await fsp.stat(resolved);
  if (stats.size > 25 * 1024 * 1024) return [];
  const needle = matchCase ? query : query.toLocaleLowerCase();
  const matches = [];
  if (path.extname(resolved).toLowerCase() === '.docx') {
    const result = await mammoth.extractRawText({ path: resolved });
    result.value.split(/\r?\n/).forEach((line, index) => {
      if (matches.length >= limit) return;
      const source = matchCase ? line : line.toLocaleLowerCase();
      const column = source.indexOf(needle);
      if (column >= 0) matches.push({ officeKind: 'docx', line: index + 1, column: column + 1, preview: line.trim().slice(0, 240) });
    });
    return matches;
  }
  if (path.extname(resolved).toLowerCase() === '.xlsx') {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(resolved);
    for (const sheet of workbook.worksheets) {
      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (matches.length >= limit) return;
        row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
          if (matches.length >= limit) return;
          const text = excelCellText(cell.value);
          const source = matchCase ? text : text.toLocaleLowerCase();
          const column = source.indexOf(needle);
          if (column >= 0) matches.push({ officeKind: 'xlsx', sheetName: sheet.name, row: rowNumber, cellColumn: columnNumber, line: rowNumber, column: column + 1, preview: `${sheet.name}!${cell.address}  ${text}`.slice(0, 240) });
        });
      });
      if (matches.length >= limit) break;
    }
  }
  return matches;
}

module.exports = { buildWordDocument, parseExcelInput, readDocx, writeDocx, readXlsx, writeXlsx, searchOffice };
