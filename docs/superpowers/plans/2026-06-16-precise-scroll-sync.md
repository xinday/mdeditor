# Precise Scroll Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace proportional editor/preview scroll sync with source-line–anchored sync that keeps the same source line aligned at the top of both panes.

**Architecture:** Swap the `<textarea>` for a CodeMirror 6 editor that exposes 0-based source-line geometry (`topLine()` / `scrollToLine()`). The markdown-it renderer stamps each top-level block with `data-source-line` (0-based). `syncScroll` linearly interpolates between those preview anchors and the editor's top source line, in both directions, keeping the existing requestAnimationFrame echo guard.

**Tech Stack:** Vite, Vitest (jsdom), markdown-it, CodeMirror 6 (`codemirror` 6.0.2, `@codemirror/lang-markdown` 6.5.0).

---

## Key API facts (verified against installed type defs)

- `import { EditorView, basicSetup } from 'codemirror'` — the `codemirror` meta-package re-exports `EditorView` and exports `basicSetup`.
- `import { markdown } from '@codemirror/lang-markdown'`.
- `view.scrollDOM` — the scrollable element (`.cm-scroller`).
- `view.documentPadding` → `{ top, bottom }`. `view.lineBlockAtHeight(h)` / `view.lineBlockAt(pos)` return a `BlockInfo` with `.from`, `.top`, `.height` (heights are document-relative, i.e. 0 = top of first line).
- Conversion (no screen-coordinate math needed):
  - top height shown at viewport top: `topHeight = view.scrollDOM.scrollTop - view.documentPadding.top`
  - scrollTop to put a document height `h` at the top: `view.scrollDOM.scrollTop = h + view.documentPadding.top`
- `view.state.doc.lineAt(pos).number` is **1-based**; `view.state.doc.line(n)` takes 1-based; `view.state.doc.lines` is the count. We expose **0-based** lines to match `data-source-line`.
- markdown-it `token.map` is `[startLine, endLine]` with **0-based** `startLine`. `token.level === 0` selects top-level blocks. `token.nesting` is `+1` (open), `0` (self-contained, e.g. `fence`/`hr`), `-1` (close).

## File structure

- `package.json` — add `codemirror`, `@codemirror/lang-markdown` (already installed in this worktree).
- `index.html` — `#editor` becomes a `<div>` mount container.
- `src/editor.js` — rewrite: CodeMirror 6 wrapper. Public API stays `getValue` / `setValue` / debounced `onChange`; adds `scrollEl`, `topLine()`, `scrollToLine()`, `view`.
- `src/renderer.js` — add a core rule stamping `data-source-line` on top-level blocks; inject the same attribute in the custom fence/mermaid renderer.
- `src/scrollsync.js` — rewrite: source-line anchored interpolation, both directions, keep the rAF echo guard; returns `{ resync }`.
- `src/main.js` — create the editor first, then `syncScroll(editor, previewEl)`; call `sync.resync()` after each preview render.
- `src/style.css` — `#editor` becomes a container; editor visual styling moves into a CodeMirror theme in `editor.js`.
- Tests updated alongside each module: `editor.test.js`, `renderer.test.js`, `scrollsync.test.js`.

---

### Task 1: Dependencies and HTML mount container

**Files:**
- Modify: `package.json` (dependencies)
- Modify: `index.html:18`

- [ ] **Step 1: Ensure CodeMirror deps are present**

Run: `npm ls codemirror @codemirror/lang-markdown`
Expected: shows `codemirror@6.x` and `@codemirror/lang-markdown@6.x`. If missing, run:

```bash
npm install codemirror @codemirror/lang-markdown
```

- [ ] **Step 2: Convert the editor element to a div container**

In `index.html`, replace the textarea line:

```html
        <textarea id="editor" spellcheck="false" placeholder="在這裡輸入 Markdown…"></textarea>
```

with:

```html
        <div id="editor"></div>
```

- [ ] **Step 3: Verify the existing suite still passes**

Run: `npm test`
Expected: PASS (25 tests). `editor.test.js` still targets the old textarea editor; it constructs its own textarea so it is unaffected by the HTML change.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json index.html
git commit -m "build: add CodeMirror 6 deps and switch #editor to a div container"
```

---

### Task 2: Rewrite the editor on CodeMirror 6

**Files:**
- Modify: `src/editor.js` (full rewrite)
- Test: `src/editor.test.js` (full rewrite)

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `src/editor.test.js` with:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createEditor } from './editor.js'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = '' // remove mounted editors + their listeners
})

function makeContainer() {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

describe('createEditor', () => {
  it('getValue/setValue read and write the document', () => {
    const ed = createEditor(makeContainer(), { onChange: () => {} })
    ed.setValue('hello')
    expect(ed.getValue()).toBe('hello')
  })

  it('debounces user edits and calls onChange with the value', () => {
    const onChange = vi.fn()
    const ed = createEditor(makeContainer(), { onChange, delay: 150 })

    ed.view.dispatch({ changes: { from: 0, insert: 'a' } })
    ed.view.dispatch({ changes: { from: 1, insert: 'b' } })

    expect(onChange).not.toHaveBeenCalled() // still within debounce window
    vi.advanceTimersByTime(150)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('ab')
  })

  it('setValue does not trigger onChange', () => {
    const onChange = vi.fn()
    const ed = createEditor(makeContainer(), { onChange, delay: 150 })

    ed.setValue('programmatic')
    vi.advanceTimersByTime(300)

    expect(onChange).not.toHaveBeenCalled()
  })

  it('exposes the scroll element and geometry helpers', () => {
    const ed = createEditor(makeContainer(), { onChange: () => {} })
    expect(ed.scrollEl).toBeInstanceOf(HTMLElement)
    expect(typeof ed.topLine).toBe('function')
    expect(typeof ed.scrollToLine).toBe('function')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/editor.test.js`
Expected: FAIL — the current `editor.js` exports a textarea wrapper with no `view`, `scrollEl`, `topLine`, or `scrollToLine`; the `ed.view.dispatch(...)` calls throw.

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `src/editor.js` with:

```js
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/editor.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/editor.js src/editor.test.js
git commit -m "feat: rewrite editor on CodeMirror 6 with source-line geometry"
```

---

### Task 3: Stamp source line numbers in the renderer

**Files:**
- Modify: `src/renderer.js`
- Test: `src/renderer.test.js`

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `src/renderer.test.js` with:

```js
import { describe, it, expect } from 'vitest'
import { render } from './renderer.js'

describe('render', () => {
  it('renders a heading', () => {
    expect(render('# Hello')).toContain('>Hello</h1>')
  })

  it('renders a GFM table', () => {
    const md = '| a | b |\n| - | - |\n| 1 | 2 |'
    expect(render(md)).toContain('<table')
  })

  it('renders strikethrough', () => {
    expect(render('~~gone~~')).toContain('<s>gone</s>')
  })

  it('renders task list checkboxes', () => {
    const out = render('- [ ] todo\n- [x] done')
    expect(out).toContain('type="checkbox"')
  })

  it('autolinks bare URLs (linkify)', () => {
    expect(render('see https://example.com')).toContain('<a href="https://example.com"')
  })

  it('highlights fenced code with hljs classes', () => {
    const out = render('```js\nconst x = 1;\n```')
    expect(out).toContain('hljs')
    expect(out).toContain('language-js')
  })

  it('turns a mermaid fence into <pre class="mermaid"> (not hljs)', () => {
    const out = render('```mermaid\ngraph TD;A-->B;\n```')
    expect(out).toContain('<pre class="mermaid"')
    expect(out).toContain('graph TD')
    expect(out).not.toContain('hljs')
  })

  it('escapes code in unknown-language fences (no raw HTML)', () => {
    const out = render('```unknownlang\n<b>raw</b>\n```')
    expect(out).toContain('hljs')
    expect(out).not.toContain('<b>raw</b>')
    expect(out).toContain('&lt;b&gt;')
  })

  it('escapes raw HTML in source (html:false)', () => {
    const out = render('<script>alert(1)</script>')
    expect(out).toContain('&lt;script&gt;')
    expect(out).not.toContain('<script>')
  })

  it('stamps top-level blocks with 0-based data-source-line', () => {
    const out = render('# A\n\npara\n')
    expect(out).toContain('<h1 data-source-line="0"')
    expect(out).toMatch(/<p data-source-line="2"/) // line 0 heading, line 1 blank, line 2 paragraph
  })

  it('stamps fenced code blocks with data-source-line on the <pre>', () => {
    const out = render('text\n\n```js\nconst x = 1;\n```\n')
    expect(out).toMatch(/<pre data-source-line="2"><code/) // fence opens at line index 2
  })

  it('stamps mermaid blocks with data-source-line', () => {
    const out = render('```mermaid\ngraph TD;A-->B;\n```')
    expect(out).toContain('<pre class="mermaid" data-source-line="0"')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/renderer.test.js`
Expected: FAIL — the three new `data-source-line` tests fail (no such attribute yet). The relaxed existing assertions pass already.

- [ ] **Step 3: Write the implementation**

In `src/renderer.js`, modify the custom fence renderer to inject the attribute, and add a core rule. Replace the fence-override block (current lines 32–45) and the trailing `render` export with the following.

Replace:

```js
const defaultFence =
  md.renderer.rules.fence ||
  function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options)
  }

md.renderer.rules.fence = function (tokens, idx, options, env, self) {
  const token = tokens[idx]
  const lang = (token.info ? token.info.trim() : '').split(/\s+/g)[0]
  if (lang === 'mermaid') {
    return `<pre class="mermaid">${md.utils.escapeHtml(token.content)}</pre>\n`
  }
  return defaultFence(tokens, idx, options, env, self)
}

export function render(markdown) {
  return md.render(markdown)
}
```

with:

```js
const defaultFence =
  md.renderer.rules.fence ||
  function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options)
  }

md.renderer.rules.fence = function (tokens, idx, options, env, self) {
  const token = tokens[idx]
  const attr = token.map ? ` data-source-line="${token.map[0]}"` : ''
  const lang = (token.info ? token.info.trim() : '').split(/\s+/g)[0]
  if (lang === 'mermaid') {
    return `<pre class="mermaid"${attr}>${md.utils.escapeHtml(token.content)}</pre>\n`
  }
  // The custom highlight() builds a full <pre><code> and bypasses attr
  // injection, so stamp the line onto the opening <pre> ourselves.
  const html = defaultFence(tokens, idx, options, env, self)
  return attr ? html.replace('<pre', `<pre${attr}`) : html
}

// Stamp every top-level block (heading, paragraph, list, blockquote, table,
// hr, code) with its 0-based source line. Preview scroll sync interpolates
// between these anchors; only opening/self-contained tokens are tagged.
md.core.ruler.push('source_line', (state) => {
  for (const token of state.tokens) {
    if (token.level === 0 && token.map && token.nesting !== -1) {
      token.attrSet('data-source-line', String(token.map[0]))
    }
  }
})

export function render(markdown) {
  return md.render(markdown)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/renderer.test.js`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer.js src/renderer.test.js
git commit -m "feat: stamp top-level blocks with data-source-line for scroll anchors"
```

---

### Task 4: Rewrite scroll sync to source-line anchoring

**Files:**
- Modify: `src/scrollsync.js` (full rewrite)
- Test: `src/scrollsync.test.js` (full rewrite)

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `src/scrollsync.test.js` with:

```js
import { describe, it, expect, afterEach, vi } from 'vitest'
import { syncScroll } from './scrollsync.js'

afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

// Build a fake preview (with stubbed scrollTop) holding anchor elements whose
// data-source-line + offsetTop we control, plus a fake editor exposing the
// scrollsync contract (scrollEl + topLine/scrollToLine spies).
function setup(anchors) {
  const preview = document.createElement('div')
  let top = 0
  Object.defineProperty(preview, 'scrollTop', { get: () => top, set: (v) => { top = v }, configurable: true })
  for (const a of anchors) {
    const el = document.createElement('div')
    el.setAttribute('data-source-line', String(a.line))
    Object.defineProperty(el, 'offsetTop', { get: () => a.top, configurable: true })
    preview.appendChild(el)
  }
  document.body.appendChild(preview)

  const scrollEl = document.createElement('div')
  document.body.appendChild(scrollEl)
  const editor = { scrollEl, topLine: vi.fn(), scrollToLine: vi.fn() }

  const sync = syncScroll(editor, preview)
  return { editor, preview, sync }
}

const ANCHORS = [
  { line: 0, top: 0 },
  { line: 10, top: 100 },
  { line: 20, top: 400 },
]

describe('syncScroll', () => {
  it('editor scroll sets preview to the interpolated pixel for the top line', () => {
    const { editor, preview } = setup(ANCHORS)
    editor.topLine.mockReturnValue(5) // halfway between line 0 (top 0) and line 10 (top 100)
    editor.scrollEl.dispatchEvent(new Event('scroll'))
    expect(preview.scrollTop).toBe(50)
  })

  it('preview scroll calls editor.scrollToLine with the interpolated line', () => {
    const { editor, preview } = setup(ANCHORS)
    preview.scrollTop = 250 // halfway between top 100 (line 10) and top 400 (line 20)
    preview.dispatchEvent(new Event('scroll'))
    expect(editor.scrollToLine).toHaveBeenCalledWith(15)
  })

  it('clamps to the last anchor when the top line is past the end', () => {
    const { editor, preview } = setup(ANCHORS)
    editor.topLine.mockReturnValue(99)
    editor.scrollEl.dispatchEvent(new Event('scroll'))
    expect(preview.scrollTop).toBe(400)
  })

  it('suppresses the echo while locked, then resumes after the frame', () => {
    const frames = []
    vi.stubGlobal('requestAnimationFrame', (cb) => { frames.push(cb); return frames.length })

    const { editor, preview } = setup(ANCHORS)
    editor.topLine.mockReturnValue(5)
    editor.scrollEl.dispatchEvent(new Event('scroll')) // locks "editor", sets preview to 50
    expect(preview.scrollTop).toBe(50)

    // While "editor" holds the lock, a preview scroll must NOT drive the editor.
    preview.scrollTop = 80
    preview.dispatchEvent(new Event('scroll'))
    expect(editor.scrollToLine).not.toHaveBeenCalled()

    frames.forEach((cb) => cb()) // release the lock

    preview.scrollTop = 80
    preview.dispatchEvent(new Event('scroll'))
    expect(editor.scrollToLine).toHaveBeenCalledTimes(1) // release works
  })

  it('does nothing when there are no anchors', () => {
    const { editor, preview } = setup([])
    editor.topLine.mockReturnValue(5)
    expect(() => editor.scrollEl.dispatchEvent(new Event('scroll'))).not.toThrow()
    preview.dispatchEvent(new Event('scroll'))
    expect(editor.scrollToLine).not.toHaveBeenCalled()
  })

  it('resync() re-aligns the preview to the editor on demand', () => {
    const { editor, preview, sync } = setup(ANCHORS)
    editor.topLine.mockReturnValue(10)
    sync.resync()
    expect(preview.scrollTop).toBe(100)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/scrollsync.test.js`
Expected: FAIL — the current `syncScroll(a, b)` expects two scrollable elements and has no `topLine`/anchor logic or `resync` return.

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `src/scrollsync.js` with:

```js
// Source-line anchored scroll sync between a CodeMirror editor and the rendered
// preview. Each preview block carries a 0-based data-source-line; the editor
// reports topLine()/scrollToLine() in 0-based source lines. Scrolling one pane
// interpolates the matching position in the other so the same source line stays
// aligned at the top edge. A re-entrancy guard (released next animation frame)
// suppresses the programmatic scroll's echo so the panes do not fight.
export function syncScroll(editor, preview) {
  let locked = null

  // Live snapshot of preview anchors as {line, top}, sorted by line. Re-read on
  // every scroll so it stays correct across re-renders.
  function anchors() {
    const list = []
    for (const el of preview.querySelectorAll('[data-source-line]')) {
      const line = Number(el.getAttribute('data-source-line'))
      if (Number.isFinite(line)) list.push({ line, top: el.offsetTop })
    }
    return list.sort((a, b) => a.line - b.line)
  }

  // Linear interpolation over sorted points: map field `kx` -> field `ky`,
  // clamping at both ends.
  function interp(points, x, kx, ky) {
    if (points.length === 0) return 0
    if (x <= points[0][kx]) return points[0][ky]
    const last = points[points.length - 1]
    if (x >= last[kx]) return last[ky]
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1]
      if (x >= a[kx] && x <= b[kx]) {
        const span = b[kx] - a[kx]
        const frac = span > 0 ? (x - a[kx]) / span : 0
        return a[ky] + frac * (b[ky] - a[ky])
      }
    }
    return last[ky]
  }

  function editorToPreview() {
    const points = anchors()
    if (points.length === 0) return
    preview.scrollTop = interp(points, editor.topLine(), 'line', 'top')
  }

  function previewToEditor() {
    const points = anchors()
    if (points.length === 0) return
    editor.scrollToLine(interp(points, preview.scrollTop, 'top', 'line'))
  }

  function guard(src, run) {
    return () => {
      if (locked && locked !== src) return
      locked = src
      run()
      requestAnimationFrame(() => { locked = null })
    }
  }

  editor.scrollEl.addEventListener('scroll', guard('editor', editorToPreview))
  preview.addEventListener('scroll', guard('preview', previewToEditor))

  // Re-align the preview to the editor (e.g. after the preview re-renders).
  return { resync: editorToPreview }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/scrollsync.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scrollsync.js src/scrollsync.test.js
git commit -m "feat: source-line anchored scroll sync with interpolation"
```

---

### Task 5: Wire the app together and adjust styles

**Files:**
- Modify: `src/main.js:32-36`, `src/main.js:46-49`
- Modify: `src/style.css:19-24`

- [ ] **Step 1: Update main.js — create the editor before syncing, resync after render**

In `src/main.js`, the current top section is:

```js
const editorEl = document.querySelector('#editor')
const previewEl = document.querySelector('#preview')
const statusEl = document.querySelector('#status')

syncScroll(editorEl, previewEl)

let currentPath = null
let dirty = false
```

Remove the early `syncScroll(editorEl, previewEl)` call (the editor object does not exist yet), leaving:

```js
const editorEl = document.querySelector('#editor')
const previewEl = document.querySelector('#preview')
const statusEl = document.querySelector('#status')

let currentPath = null
let dirty = false
```

Then change `renderPreview` (currently):

```js
async function renderPreview(text) {
  previewEl.innerHTML = render(text)
  await renderMermaid(previewEl)
}
```

to re-align after the DOM (and mermaid heights) settle:

```js
async function renderPreview(text) {
  previewEl.innerHTML = render(text)
  await renderMermaid(previewEl)
  sync.resync()
}
```

And immediately after the `const editor = createEditor(...)` block, create the sync:

```js
const editor = createEditor(editorEl, {
  onChange: (text) => {
    dirty = true
    setStatus()
    saveDraft(text)
    renderPreview(text).catch(console.error)
  },
})

const sync = syncScroll(editor, previewEl)
```

(`renderPreview` is a hoisted function declaration; it only runs after `sync` is assigned — first at boot, then on user edits — so referencing `sync` inside it is safe.)

- [ ] **Step 2: Update style.css — make #editor a container, let CodeMirror fill it**

In `src/style.css`, replace the `#editor` rule (current lines 19–23):

```css
#editor {
  border: none; border-right: 1px solid var(--border); resize: none;
  padding: 16px; font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
  font-size: 14px; line-height: 1.6; outline: none; overflow: auto;
}
```

with:

```css
#editor {
  border-right: 1px solid var(--border);
  min-width: 0; min-height: 0; overflow: hidden;
}
#editor .cm-editor { height: 100%; }
#editor .cm-editor.cm-focused { outline: none; }
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — editor (4) + renderer (12) + scrollsync (6) + files + storage. No failures.

- [ ] **Step 4: Manual verification in the browser**

Run: `npm run dev` and open the printed URL (http://localhost:1420).
Verify:
- The editor shows line numbers, Markdown syntax highlighting, and wraps long lines.
- Typing updates the preview; the status shows the dirty dot.
- Scroll the editor through the default doc (heading, table, task list, code block, mermaid). The block at the top of the editor stays aligned with the same block at the top of the preview — markedly tighter than before, especially around the code block and mermaid diagram.
- Scroll the preview; the editor follows to the matching source line.
Stop the dev server when done (Ctrl+C).

- [ ] **Step 5: Commit**

```bash
git add src/main.js src/style.css
git commit -m "feat: wire CodeMirror editor + source-line scroll sync into the app"
```

---

## Self-review

- **Spec coverage:** renderer `data-source-line` (Task 3) ✓; CodeMirror swap with line geometry + line numbers/highlight/wrapping (Task 2) ✓; source-line anchored interpolation both directions + rAF echo guard preserved (Task 4) ✓; main.js passes the editor object and resyncs after render (Task 5) ✓; style.css container + theme (Task 2 theme, Task 5 CSS) ✓; test strategy — scrollsync interpolation + echo guard, renderer attribute tests, editor getValue/setValue/onChange with no geometry unit tests (Tasks 2–4) ✓; YAGNI non-goals respected ✓.
- **Placeholder scan:** none — every code step has complete code and exact commands.
- **Type/name consistency:** editor exposes `scrollEl`, `topLine`, `scrollToLine`, `view`, `getValue`, `setValue`; `syncScroll(editor, preview)` consumes exactly those and returns `{ resync }`; `main.js` uses `sync.resync()`. 0-based source lines are consistent across renderer (`token.map[0]`), editor geometry, and `scrollsync` interpolation.
- **Known minor limitations (acceptable, by design):** indented code blocks and deeply nested list items are not individually anchored — interpolation across neighbouring anchors covers the gap; tail-of-document alignment clamps to the last anchor rather than the absolute bottom.
```
