import { EditorState, Compartment, StateEffect, StateField } from '@codemirror/state';
import { EditorView, Decoration, WidgetType, lineNumbers, highlightSpecialChars, drawSelection } from '@codemirror/view';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { cpp } from '@codemirror/lang-cpp';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { textChange } from '../lib/position.mjs';

const markLine = StateEffect.define();
class RemoteCaret extends WidgetType {
  toDOM() { const node = document.createElement('span'); node.className = 'remote-caret'; node.setAttribute('aria-hidden', 'true'); return node; }
  ignoreEvent() { return true; }
}
const lineField = StateField.define({
  create: () => Decoration.none,
  update(value, tr) {
    value = value.map(tr.changes);
    for (const effect of tr.effects) if (effect.is(markLine)) {
      const pos = Math.max(0, Math.min(effect.value.position, tr.state.doc.length));
      const marks = [Decoration.line({ class: 'code-current-line' }).range(tr.state.doc.lineAt(pos).from)];
      if (effect.value.cursor) marks.push(Decoration.widget({ widget: new RemoteCaret(), side: 1 }).range(pos));
      value = Decoration.set(marks, true);
    }
    return value;
  },
  provide: field => EditorView.decorations.from(field)
});
const colors = HighlightStyle.define([
  { tag: tags.keyword, color: '#d2a4f6' },
  { tag: [tags.string, tags.special(tags.string)], color: '#a7d6a6' },
  { tag: tags.comment, color: '#7e8999' },
  { tag: [tags.number, tags.bool], color: '#e9be83' },
  { tag: [tags.typeName, tags.className], color: '#82c9d1' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: '#e8d39b' },
  { tag: tags.meta, color: '#9ba9d7' },
  { tag: tags.operator, color: '#b8c2ce' }
]);
const baseTheme = EditorView.theme({
  '&': { height: '100%', backgroundColor: '#141b26', color: '#e7edf6' },
  '.cm-scroller': { fontFamily: 'Consolas, "Cascadia Code", "Courier New", monospace', lineHeight: '1.43', overflow: 'auto' },
  '.cm-content': { padding: '9px 0 28px', caretColor: 'transparent' },
  '.cm-line': { padding: '0 10px 0 6px' },
  '.cm-gutters': { backgroundColor: '#141b26', color: '#9aa9bd', border: 'none', minWidth: '2.8em' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 9px 0 6px' },
  '.cm-selectionBackground': { background: '#244959 !important' },
  '&.cm-focused': { outline: 'none' },
  '.code-current-line': { backgroundColor: '#efbb6d0a', boxShadow: 'inset 2px 0 #efbb6d' }
}, { dark: true });

export class CodePanel {
  constructor(parent, { fontSize, wrap }) {
    this.language = new Compartment();
    this.sizing = new Compartment();
    this.wrapping = new Compartment();
    this.currentLanguage = 'cpp';
    this.currentSize = fontSize;
    this.currentWrap = wrap;
    this.view = new EditorView({ parent, state: EditorState.create({ doc: '', extensions: [
      EditorState.readOnly.of(true), EditorView.editable.of(false), lineNumbers(), highlightSpecialChars(), drawSelection(),
      baseTheme, syntaxHighlighting(colors), lineField,
      this.language.of(cpp()), this.sizing.of(EditorView.theme({ '&': { fontSize: `${fontSize}px` } })),
      this.wrapping.of(wrap ? EditorView.lineWrapping : []),
      EditorView.contentAttributes.of({ 'aria-label': 'Code thí sinh · chỉ đọc', spellcheck: 'false' })
    ] }) });
    this.resize = new ResizeObserver(() => { if (this.followEnabled) this.follow(this.lastPosition || 0); });
    this.resize.observe(parent);
  }
  configure({ language, fontSize, wrap }) {
    const effects = [];
    if (language !== this.currentLanguage) {
      this.currentLanguage = language;
      effects.push(this.language.reconfigure(language === 'py' ? python() : language === 'java' ? java() : cpp()));
    }
    if (fontSize !== this.currentSize) { this.currentSize = fontSize; effects.push(this.sizing.reconfigure(EditorView.theme({ '&': { fontSize: `${fontSize}px` } }))); }
    if (wrap !== this.currentWrap) { this.currentWrap = wrap; effects.push(this.wrapping.reconfigure(wrap ? EditorView.lineWrapping : [])); }
    if (effects.length) this.view.dispatch({ effects });
  }
  update(code, offset, shouldFollow, cursor = false) {
    const before = this.view.state.doc.toString();
    const position = Math.max(0, Math.min(Number.isFinite(offset) ? offset : 0, code.length));
    const effects = [markLine.of({ position, cursor })];
    this.view.dispatch({ ...(before === code ? {} : { changes: textChange(before, code) }), effects });
    this.followEnabled = shouldFollow;
    this.lastPosition = position;
    if (shouldFollow) this.follow(position);
  }
  follow(position) {
    cancelAnimationFrame(this.followFrame);
    this.followFrame = requestAnimationFrame(() => {
      if (!this.followEnabled) return;
      this.view.dispatch({ effects: EditorView.scrollIntoView(Math.min(position, this.view.state.doc.length), { y: 'center', x: 'nearest' }) });
      this.view.requestMeasure({
        key: this,
        read: view => {
          const block = view.lineBlockAt(Math.min(position, view.state.doc.length));
          return { top: block.top, height: block.height, viewport: view.scrollDOM.clientHeight };
        },
        write: value => { if (this.followEnabled) this.view.scrollDOM.scrollTop = Math.max(0, value.top + value.height / 2 - value.viewport / 2); }
      });
    });
  }
  destroy() { this.resize.disconnect(); cancelAnimationFrame(this.followFrame); this.view.destroy(); }
}
