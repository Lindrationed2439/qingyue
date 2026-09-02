const test = require('node:test');
const assert = require('node:assert/strict');
const { isMarkdown, isSupported } = require('../electron/file-types.cjs');

test('recognizes Markdown extensions without case sensitivity', () => {
  assert.equal(isMarkdown('C:\\notes\\README.MD'), true);
  assert.equal(isMarkdown('data.json'), false);
});

test('recognizes common text, office, creative and media files', () => {
  for (const file of ['app.ts', 'data.json', 'notes.txt', 'config.yaml', 'script.py', 'Dockerfile', 'report.docx', 'budget.xlsx', 'board.excalidraw', 'map.xmind', 'photo.png', 'voice.mp3']) {
    assert.equal(isSupported(file), true, file);
  }
  assert.equal(isSupported('archive.zip'), false);
});
