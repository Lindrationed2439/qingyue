// Small, local-only text editor used by the Lite build. No Monaco or language workers.
import './lite-icons.css';
type Position = { lineNumber: number; column: number };
export class Range {
  constructor(public startLineNumber: number, public startColumn: number, public endLineNumber: number, public endColumn: number) {}
}
export const Uri = { parse: (value: string) => ({ toString: () => value }) };

class TextModel {
  undoStack: string[] = [];
  redoStack: string[] = [];
  private lastUndoAt = 0;
  constructor(public value: string, private language: string) {}
  getValue() { return this.value; }
  getLanguageId() { return this.language; }
  getLineCount() { return this.value.split('\n').length; }
  getLineContent(line: number) { return this.value.split('\n')[line - 1] || ''; }
  offset(position: Position) {
    const lines = this.value.split('\n');
    const line = Math.max(1, Math.min(lines.length, position.lineNumber));
    let offset = 0;
    for (let index = 0; index < line - 1; index += 1) offset += lines[index].length + 1;
    return offset + Math.min(lines[line - 1].length, Math.max(0, position.column - 1));
  }
  position(offset: number): Position {
    const before = this.value.slice(0, offset).split('\n');
    return { lineNumber: before.length, column: before[before.length - 1].length + 1 };
  }
  getFullModelRange() {
    const lines = this.value.split('\n');
    return new Range(1, 1, lines.length, lines[lines.length - 1].length + 1);
  }
  getValueInRange(range: Range) {
    return this.value.slice(this.offset({ lineNumber: range.startLineNumber, column: range.startColumn }), this.offset({ lineNumber: range.endLineNumber, column: range.endColumn }));
  }
  change(value: string) {
    if (value === this.value) return;
    // Group typing and bound retained text; large files must not keep 100 full copies.
    const now = Date.now();
    if (now - this.lastUndoAt > 500 || !this.undoStack.length) {
      this.undoStack.push(this.value); this.lastUndoAt = now;
      while (this.undoStack.length > 1 && (this.undoStack.length > 100 || this.undoStack.reduce((sum, item) => sum + item.length * 2, 0) > 8 * 1024 * 1024)) this.undoStack.shift();
    }
    this.redoStack = [];
    this.value = value;
  }
  dispose() { this.value = ''; this.undoStack = []; this.redoStack = []; }
}

class LiteEditor {
  private model: TextModel | null;
  private textarea: HTMLTextAreaElement;
  private gutter: HTMLElement;
  private contentListeners: Array<() => void> = [];
  private cursorListeners: Array<(event: { position: Position }) => void> = [];
  private scrollListeners: Array<(event: { scrollTopChanged: boolean; scrollTop: number }) => void> = [];
  private decorations: Array<any> = [];
  constructor(host: HTMLElement, options: any) {
    this.model = options.model;
    host.classList.add('lite-editor');
    host.innerHTML = '<div class="lite-find" hidden><input aria-label="查找文本" placeholder="查找文本，Enter 下一处"><button type="button">关闭</button></div><div class="lite-gutter"></div><textarea class="lite-input" aria-label="文本编辑器" spellcheck="false"></textarea>';
    this.textarea = host.querySelector('textarea')!;
    this.gutter = host.querySelector('.lite-gutter')!;
    this.textarea.value = this.model?.getValue() || '';
    const find = host.querySelector<HTMLElement>('.lite-find')!;
    const query = find.querySelector('input')!;
    find.querySelector('button')!.onclick = () => { find.hidden = true; this.focus(); };
    query.onkeydown = (event) => {
      if (event.key === 'Escape') { find.hidden = true; this.focus(); }
      if (event.key !== 'Enter' || !query.value) return;
      const text = this.textarea.value.toLowerCase();
      const value = query.value.toLowerCase();
      const start = event.shiftKey ? text.lastIndexOf(value, Math.max(0, this.textarea.selectionStart - 1)) : text.indexOf(value, this.textarea.selectionEnd);
      const found = start < 0 ? text.indexOf(value) : start;
      if (found >= 0) {
        this.textarea.setSelectionRange(found, found + query.value.length);
        this.revealLineInCenter(this.model?.position(found).lineNumber || 1);
        this.emitCursor();
      }
    };
    this.textarea.addEventListener('input', () => {
      this.model?.change(this.textarea.value);
      this.changed();
    });
    this.textarea.addEventListener('scroll', () => {
      this.paintGutter();
      this.scrollListeners.forEach((listener) => listener({ scrollTopChanged: true, scrollTop: this.textarea.scrollTop }));
    });
    for (const name of ['keyup', 'click', 'select']) this.textarea.addEventListener(name, () => this.emitCursor());
    this.textarea.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault(); find.hidden = false; query.focus(); query.select(); return;
      }
      if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase()) && this.model) {
        event.preventDefault();
        const redo = event.key.toLowerCase() === 'y' || event.shiftKey;
        const stack = redo ? this.model.redoStack : this.model.undoStack;
        const next = stack.pop();
        if (next !== undefined) {
          (redo ? this.model.undoStack : this.model.redoStack).push(this.model.value);
          this.model.value = next; this.textarea.value = next; this.changed();
        }
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        this.executeEdits('indent', [{ range: this.getSelection(), text: '  ' }]);
      }
    });
    new ResizeObserver(() => this.paintGutter()).observe(host);
    this.paintGutter();
  }
  private changed() { this.paintGutter(); this.contentListeners.forEach((listener) => listener()); this.emitCursor(); }
  private emitCursor() { this.cursorListeners.forEach((listener) => listener({ position: this.getPosition() })); }
  private paintGutter() {
    const lineHeight = 23;
    const first = Math.max(1, Math.floor(this.textarea.scrollTop / lineHeight) + 1);
    const count = Math.min(100, Math.ceil(this.textarea.clientHeight / lineHeight) + 2);
    const total = this.model?.getLineCount() || 1;
    this.gutter.replaceChildren();
    // Only paint visible line numbers, rather than one DOM element per document line.
    this.gutter.style.paddingTop = (22 - this.textarea.scrollTop % lineHeight) + 'px';
    for (let line = first; line < first + count && line <= total; line += 1) {
      const row = document.createElement('div');
      row.textContent = String(line);
      const marker = this.decorations.find((item) => item.range.startLineNumber === line);
      if (marker) { row.className = 'lite-marker'; row.title = marker.options.glyphMarginHoverMessage?.value || '书签 / 批注'; }
      this.gutter.append(row);
    }
  }
  getModel() { return this.model; }
  setModel(model: TextModel | null) {
    this.model = model; this.textarea.value = model?.getValue() || ''; this.textarea.scrollTop = 0; this.paintGutter();
  }
  getValue() { return this.model?.getValue() || ''; }
  getPosition() { return this.model?.position(this.textarea.selectionStart) || { lineNumber: 1, column: 1 }; }
  getSelection() {
    const a = this.model?.position(this.textarea.selectionStart) || { lineNumber: 1, column: 1 };
    const b = this.model?.position(this.textarea.selectionEnd) || a;
    return new Range(a.lineNumber, a.column, b.lineNumber, b.column);
  }
  setPosition(position: Position) {
    const offset = this.model?.offset(position) || 0; this.textarea.setSelectionRange(offset, offset); this.emitCursor();
  }
  revealLineInCenter(line: number) { this.textarea.scrollTop = Math.max(0, (line - 1) * 23 - this.textarea.clientHeight / 2); this.paintGutter(); }
  executeEdits(_source: string, edits: Array<{ range: Range; text: string }>) {
    if (!this.model) return;
    const prepared = edits.map((edit) => ({ start: this.model!.offset({ lineNumber: edit.range.startLineNumber, column: edit.range.startColumn }), end: this.model!.offset({ lineNumber: edit.range.endLineNumber, column: edit.range.endColumn }), text: edit.text })).sort((a, b) => b.start - a.start);
    let value = this.model.value;
    for (const edit of prepared) value = value.slice(0, edit.start) + edit.text + value.slice(edit.end);
    this.model.change(value); this.textarea.value = value;
    const caret = prepared.length ? prepared[0].start + prepared[0].text.length : 0;
    this.textarea.setSelectionRange(caret, caret); this.changed();
  }
  updateOptions(_options: any) { /* Fixed no-wrap native editor avoids costly language services. */ }
  layout() { this.paintGutter(); }
  focus() { this.textarea.focus(); }
  getScrollHeight() { return this.textarea.scrollHeight; }
  getLayoutInfo() { return { height: this.textarea.clientHeight }; }
  getAction(_name: string) { return null; }
  onDidChangeModelContent(listener: () => void) { this.contentListeners.push(listener); }
  onDidChangeCursorPosition(listener: (event: { position: Position }) => void) { this.cursorListeners.push(listener); }
  onDidScrollChange(listener: (event: { scrollTopChanged: boolean; scrollTop: number }) => void) { this.scrollListeners.push(listener); }
  createDecorationsCollection(items: any[]) {
    this.decorations = items; this.paintGutter();
    return { clear: () => { this.decorations = []; this.paintGutter(); } };
  }
}

export const editor = {
  createModel: (text: string, language: string, _uri?: unknown) => new TextModel(text, language),
  create: (host: HTMLElement, options: any) => new LiteEditor(host, options),
  defineTheme: (_name: string, _theme: unknown) => undefined,
  setTheme: (_name: string) => undefined,
  OverviewRulerLane: { Right: 4 }, ScrollType: { Smooth: 0 },
};
