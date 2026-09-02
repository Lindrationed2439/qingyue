const path = require('node:path');
const { excludedExtensions } = require('./edition.cjs');

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd', '.mdx']);
const SUPPORTED_EXTENSIONS = [
  '.md', '.markdown', '.mdown', '.mkd', '.mdx', '.txt', '.log', '.json', '.jsonc',
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.css', '.scss', '.less', '.html',
  '.htm', '.xml', '.svg', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.env',
  '.py', '.java', '.c', '.h', '.cpp', '.hpp', '.cs', '.go', '.rs', '.php', '.rb',
  '.swift', '.kt', '.kts', '.sql', '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd',
  '.dockerfile', '.gitignore', '.editorconfig', '.properties', '.csv', '.tsv', '.docx', '.xlsx',
  '.excalidraw', '.mindmap', '.smm', '.xmind', '.mm', '.opml',
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.mp3', '.wav', '.m4a', '.ogg', '.flac'
];

// These formats can execute commands when double-clicked on Windows. QingYue may
// still open them from its own file picker or drag/drop, but must never advertise
// itself as an OS handler because doing so can break or replace execution semantics.
const PROTECTED_EXECUTABLE_EXTENSIONS = new Set([
  '.bat', '.cmd', '.ps1', '.psm1', '.psd1', '.reg', '.com', '.exe', '.msi', '.msp', '.mst',
  '.scr', '.cpl', '.lnk', '.url', '.vbs', '.vbe', '.jse', '.wsf', '.wsh', '.hta',
]);
const ASSOCIATION_EXTENSIONS = SUPPORTED_EXTENSIONS.filter((extension) => !PROTECTED_EXECUTABLE_EXTENSIONS.has(extension) && !excludedExtensions.has(extension));

function isMarkdown(filePath = '') {
  return MARKDOWN_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function isSupported(filePath = '') {
  const base = path.basename(filePath).toLowerCase();
  const ext = path.extname(filePath).toLowerCase();
  return !excludedExtensions.has(ext) && (SUPPORTED_EXTENSIONS.includes(ext) || ['dockerfile', 'makefile', 'license', 'readme'].includes(base));
}

module.exports = { MARKDOWN_EXTENSIONS, SUPPORTED_EXTENSIONS, PROTECTED_EXECUTABLE_EXTENSIONS, ASSOCIATION_EXTENSIONS, isMarkdown, isSupported };
