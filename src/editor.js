import { EditorView, basicSetup } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'

// Visual styling for the editor lives with the component (keeps the prior
// monospace look). The container (#editor) just provides the box to fill.
const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '14px' },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, "Cascadia Code", Consolas, monospace',
    lineHeight: '1.6',
    overflow: 'auto',
  },
  '.cm-content': { padding: '16px 0' },
})

// Wraps a CodeMirror 6 editor mounted into `container`. Keeps the textarea-era
// public API (getValue / setValue / debounced onChange) and adds 0-based
// source-line geometry (topLine / scrollToLine) plus the scroll element, so
// scrollsync can stay editor-agnostic.
export function createEditor(container, { onChange, delay = 150 } = {}) {
  let timer = null
  let programmatic = false // suppress onChange for setValue-driven edits

  const view = new EditorView({
    doc: '',
    parent: container,
    extensions: [
      basicSetup, // line numbers, history, active-line highlight, etc.
      markdown(), // Markdown syntax highlighting
      EditorView.lineWrapping, // wrap long lines (keep the textarea feel)
      theme,
      EditorView.updateListener.of((update) => {
        if (!update.docChanged || programmatic) return
        if (timer) clearTimeout(timer)
        const text = update.state.doc.toString()
        timer = setTimeout(() => onChange(text), delay)
      }),
    ],
  })

  // The 0-based source line (with intra-line fraction) at the top edge.
  function topLine() {
    const topHeight = view.scrollDOM.scrollTop - view.documentPadding.top
    const block = view.lineBlockAtHeight(topHeight)
    const line0 = view.state.doc.lineAt(block.from).number - 1
    const frac = block.height > 0 ? (topHeight - block.top) / block.height : 0
    return line0 + Math.max(0, Math.min(1, frac))
  }

  // Scroll so that 0-based `line0Float` sits at the top edge.
  function scrollToLine(line0Float) {
    const total = view.state.doc.lines
    const ln0 = Math.max(0, Math.min(total - 1, Math.floor(line0Float)))
    const frac = line0Float - Math.floor(line0Float)
    const block = view.lineBlockAt(view.state.doc.line(ln0 + 1).from)
    const targetHeight = block.top + frac * block.height
    view.scrollDOM.scrollTop = targetHeight + view.documentPadding.top
  }

  return {
    getValue: () => view.state.doc.toString(),
    setValue: (text) => {
      programmatic = true
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } })
      programmatic = false
    },
    scrollEl: view.scrollDOM,
    topLine,
    scrollToLine,
    view,
  }
}
