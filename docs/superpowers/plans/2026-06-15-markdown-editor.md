# Markdown Editor (Tauri v2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a KISS markdown editor with live split-pane preview (GFM + syntax highlighting + mermaid), file open/save, and localStorage autosave — runnable both as a web app (Vite) and as a desktop window (Tauri v2).

**Architecture:** A vanilla-JS ESM frontend (no framework) built with Vite. One pure, testable rendering module (`renderer.js`) turns markdown into an HTML string; a separate `mermaid.js` performs DOM-side diagram rendering with per-diagram error isolation. `editor.js`, `storage.js`, and `files.js` are small single-responsibility units wired together by `main.js`. Tauri v2 wraps the same frontend as a desktop app, using the dialog + fs plugins for native file open/save. The web build degrades file ops to `<input type=file>` upload and Blob download.

**Tech Stack (verified versions, 2026-06-15):** Vite 8.0.16, Vitest 4.1.8, jsdom 29.1.1, markdown-it 14.2.0, markdown-it-task-lists 2.1.1, highlight.js 11.11.1 (`lib/common`), mermaid 11.15.0, Tauri v2 (`@tauri-apps/cli` 2.11.2, `tauri` crate 2.11.2, `tauri-build` 2.6.2, `tauri-plugin-dialog` 2.7.1, `tauri-plugin-fs` 2.5.1).

**Note on module split vs. spec:** The design doc listed a single `renderer.js` owning both markdown→HTML and `runMermaid`. This plan splits the mermaid DOM rendering into its own `mermaid.js` so `renderer.js` stays a pure, fast-to-test string function that does not import the heavy mermaid bundle. This is a small, justified refinement of the spec.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `index.html` | Page shell: toolbar + split-pane (`#editor` textarea, `#preview` div). |
| `vite.config.js` | Vite config + Tauri-friendly dev server (port 1420) + Vitest jsdom block. |
| `package.json` | Scripts and dependencies. |
| `src/main.js` | Entry point: wires editor → render → preview → mermaid + autosave/restore + toolbar + shortcuts + file state. |
| `src/renderer.js` | markdown-it instance (GFM + task lists + highlight.js) + mermaid fence override. Pure `render(md) → htmlString`. |
| `src/mermaid.js` | mermaid init + `renderMermaid(container)` with per-diagram error box. |
| `src/editor.js` | `createEditor(textarea, {onChange})` with debounced input. |
| `src/storage.js` | `loadDraft()` / `saveDraft(text)` over localStorage. |
| `src/files.js` | `isTauri()`, `basename()`, `openFile()`, `saveFile()`, `saveFileAs()` — Tauri native + web fallback. |
| `src/style.css` | Layout + preview/code/mermaid-error styling. |
| `src-tauri/` | Tauri Rust project: `Cargo.toml`, `build.rs`, `src/main.rs`, `src/lib.rs`, `tauri.conf.json`, `capabilities/default.json`, `icons/`. |
| `scripts/make-icon.cjs` | Generates a 1024×1024 source PNG (offline) so the Tauri CLI can produce app icons. |
| `src/*.test.js` | Vitest unit tests for renderer, storage, editor, files. |

---

## Task 1: Project scaffold (Vite + vanilla JS)

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/main.js`, `src/style.css`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "mdeditor",
  "private": true,
  "type": "module",
  "version": "0.1.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  }
}
```

- [ ] **Step 2: Install frontend + dev dependencies**

Run (in project root):
```bash
npm install markdown-it@14.2.0 markdown-it-task-lists@2.1.1 highlight.js@11.11.1 mermaid@11.15.0
npm install --save-dev vite@^8 vitest@^4 jsdom@^29
```
Expected: `node_modules/` created, `package.json` gains `dependencies` and `devDependencies`, no errors.

- [ ] **Step 3: Create `vite.config.js`** (Tauri-friendly server + Vitest jsdom)

```js
import { defineConfig } from 'vitest/config'

// Vanilla JS: no framework plugin needed. index.html at the root is the entry.
export default defineConfig({
  clearScreen: false,            // keep cargo/Rust output visible (TOP-LEVEL, not under server)
  server: {
    port: 1420,
    strictPort: true,            // Tauri's devUrl points at 1420; fail rather than drift
    watch: { ignored: ['**/src-tauri/**'] },
  },
  test: {
    environment: 'jsdom',        // renderer/editor/storage tests touch the DOM
  },
})
```

- [ ] **Step 4: Create `index.html`** (toolbar + split-pane shell)

```html
<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>mdeditor</title>
  </head>
  <body>
    <div id="app">
      <header id="toolbar">
        <button id="btn-new" type="button">新建</button>
        <button id="btn-open" type="button">開啟</button>
        <button id="btn-save" type="button">存檔</button>
        <button id="btn-saveas" type="button">另存為</button>
        <span id="status"></span>
      </header>
      <main id="panes">
        <textarea id="editor" spellcheck="false" placeholder="在這裡輸入 Markdown…"></textarea>
        <div id="preview" class="markdown-body"></div>
      </main>
    </div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `src/style.css`** (layout)

```css
:root { --border: #e2e8f0; --bg: #ffffff; --fg: #1e293b; --muted: #64748b; }
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body { font-family: system-ui, "Segoe UI", sans-serif; color: var(--fg); background: var(--bg); }

#app { display: flex; flex-direction: column; height: 100vh; }
#toolbar {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-bottom: 1px solid var(--border); flex: 0 0 auto;
}
#toolbar button {
  padding: 6px 12px; border: 1px solid var(--border); background: #f8fafc;
  border-radius: 6px; cursor: pointer; font-size: 14px;
}
#toolbar button:hover { background: #eef2f7; }
#status { margin-left: auto; color: var(--muted); font-size: 13px; }

#panes { display: grid; grid-template-columns: 1fr 1fr; flex: 1 1 auto; min-height: 0; }
#editor {
  border: none; border-right: 1px solid var(--border); resize: none;
  padding: 16px; font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
  font-size: 14px; line-height: 1.6; outline: none; overflow: auto;
}
#preview { padding: 16px 24px; overflow: auto; }
#preview pre { background: #f6f8fa; padding: 12px; border-radius: 6px; overflow: auto; }
#preview table { border-collapse: collapse; }
#preview th, #preview td { border: 1px solid var(--border); padding: 6px 12px; }

.mermaid-error {
  border: 1px solid #e11d48; background: #fff1f2; color: #9f1239;
  padding: 0.75rem 1rem; border-radius: 6px; font-size: 0.85rem;
}
.mermaid-error pre { margin: 0.5rem 0 0; white-space: pre-wrap; word-break: break-word; background: transparent; }
```

- [ ] **Step 6: Create a stub `src/main.js`** (so the dev server has an entry)

```js
import './style.css'

console.log('mdeditor booting')
```

- [ ] **Step 7: Verify the dev server runs**

Run: `npm run dev`
Expected: Vite prints `Local:   http://localhost:1420/`. Open it — you see the toolbar and an empty split pane. Stop the server (Ctrl+C).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vite.config.js index.html src/main.js src/style.css
git commit -m "feat: scaffold Vite vanilla-JS project with split-pane shell"
```

---

## Task 2: Markdown renderer (`renderer.js`) — TDD

**Files:**
- Create: `src/renderer.js`
- Test: `src/renderer.test.js`

- [ ] **Step 1: Write the failing test**

`src/renderer.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { render } from './renderer.js'

describe('render', () => {
  it('renders a heading', () => {
    expect(render('# Hello')).toContain('<h1>Hello</h1>')
  })

  it('renders a GFM table', () => {
    const md = '| a | b |\n| - | - |\n| 1 | 2 |'
    expect(render(md)).toContain('<table>')
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
    expect(out).toContain('<pre class="mermaid">')
    expect(out).toContain('graph TD')
    expect(out).not.toContain('hljs') // mermaid block must bypass the highlighter
  })

  it('escapes raw HTML in source (html:false)', () => {
    const out = render('<script>alert(1)</script>')
    expect(out).toContain('&lt;script&gt;')
    expect(out).not.toContain('<script>')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- renderer`
Expected: FAIL — `Failed to resolve import "./renderer.js"` (module does not exist yet).

- [ ] **Step 3: Implement `src/renderer.js`**

```js
import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import hljs from 'highlight.js/lib/common'
import 'highlight.js/styles/github.css'

// highlight callback: (str, lang) => string of HTML.
// Returns a FULL <pre><code class="hljs ..."> wrapper so markdown-it does NOT
// re-wrap it and the theme's .hljs styles apply. Never throws.
function highlight(str, lang) {
  if (lang && hljs.getLanguage(lang)) {
    try {
      const inner = hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
      return `<pre><code class="hljs language-${lang}">${inner}</code></pre>`
    } catch (_) { /* fall through */ }
  }
  // Unknown/missing language: escape ourselves (markdown-it only auto-escapes
  // when highlight returns ''). md is defined by the time this runs (at render).
  return `<pre><code class="hljs">${md.utils.escapeHtml(str)}</code></pre>`
}

const md = new MarkdownIt({
  html: false,        // raw HTML in source is escaped — safe default, no DOMPurify needed
  linkify: true,      // defaults to false; autolink bare URLs
  typographer: true,
  highlight,
})

// Tables + strikethrough are built-in and ON by default (GFM). Add task lists.
// (markdown-it-task-lists ships CJS; default import works under Vite/Vitest.)
md.use(taskLists, { enabled: true, label: true })

// Override the fence renderer so ```mermaid blocks become <pre class="mermaid">
// with escaped raw code; every other language falls through to the default
// renderer (which invokes `highlight`).
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- renderer`
Expected: PASS — all 8 assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/renderer.js src/renderer.test.js
git commit -m "feat: markdown renderer with GFM, highlight.js, and mermaid fences"
```

---

## Task 3: Draft storage (`storage.js`) — TDD

**Files:**
- Create: `src/storage.js`
- Test: `src/storage.test.js`

- [ ] **Step 1: Write the failing test**

`src/storage.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest'
import { loadDraft, saveDraft } from './storage.js'

describe('draft storage', () => {
  beforeEach(() => localStorage.clear())

  it('returns empty string when nothing is saved', () => {
    expect(loadDraft()).toBe('')
  })

  it('round-trips saved content', () => {
    saveDraft('# hi')
    expect(loadDraft()).toBe('# hi')
  })

  it('overwrites previous content', () => {
    saveDraft('first')
    saveDraft('second')
    expect(loadDraft()).toBe('second')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- storage`
Expected: FAIL — cannot resolve `./storage.js`.

- [ ] **Step 3: Implement `src/storage.js`**

```js
const KEY = 'mdeditor:draft'

export function loadDraft() {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch (_) {
    return '' // localStorage unavailable (e.g. privacy mode) — degrade silently
  }
}

export function saveDraft(text) {
  try {
    localStorage.setItem(KEY, text)
  } catch (_) {
    /* ignore write failures */
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- storage`
Expected: PASS — 3 assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/storage.js src/storage.test.js
git commit -m "feat: localStorage draft autosave/restore"
```

---

## Task 4: Editor wrapper (`editor.js`) — TDD

**Files:**
- Create: `src/editor.js`
- Test: `src/editor.test.js`

- [ ] **Step 1: Write the failing test**

`src/editor.test.js`:
```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createEditor } from './editor.js'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function makeTextarea() {
  const ta = document.createElement('textarea')
  document.body.appendChild(ta)
  return ta
}

describe('createEditor', () => {
  it('getValue/setValue read and write the textarea', () => {
    const ta = makeTextarea()
    const ed = createEditor(ta, { onChange: () => {} })
    ed.setValue('hello')
    expect(ta.value).toBe('hello')
    expect(ed.getValue()).toBe('hello')
  })

  it('debounces input and calls onChange with the value', () => {
    const ta = makeTextarea()
    const onChange = vi.fn()
    createEditor(ta, { onChange, delay: 150 })

    ta.value = 'a'
    ta.dispatchEvent(new Event('input'))
    ta.value = 'ab'
    ta.dispatchEvent(new Event('input'))

    expect(onChange).not.toHaveBeenCalled() // still within debounce window
    vi.advanceTimersByTime(150)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('ab')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- editor`
Expected: FAIL — cannot resolve `./editor.js`.

- [ ] **Step 3: Implement `src/editor.js`**

```js
// Wraps a <textarea>: exposes get/set value and a debounced change callback.
export function createEditor(textarea, { onChange, delay = 150 } = {}) {
  let timer = null
  textarea.addEventListener('input', () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => onChange(textarea.value), delay)
  })
  return {
    getValue: () => textarea.value,
    setValue: (text) => { textarea.value = text },
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- editor`
Expected: PASS — 2 assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/editor.js src/editor.test.js
git commit -m "feat: debounced textarea editor wrapper"
```

---

## Task 5: Mermaid rendering (`mermaid.js`)

**Files:**
- Create: `src/mermaid.js`

No unit test: mermaid renders real SVG and needs browser layout APIs (e.g. `getBBox`) that jsdom does not provide. This module is verified manually in the browser in Task 6.

- [ ] **Step 1: Implement `src/mermaid.js`**

```js
import mermaid from 'mermaid'

// Initialize ONCE at module load (never per render).
mermaid.initialize({
  startOnLoad: false,      // we drive rendering ourselves
  securityLevel: 'strict', // sanitize untrusted user-typed diagrams
  theme: 'default',
})

let counter = 0

/**
 * Render every <pre class="mermaid"> inside `container`.
 * Each diagram renders in its own try/catch via mermaid.render, so one bad
 * diagram never throws or breaks the others — it is replaced by an error box.
 * Because the caller regenerates container.innerHTML each update, nodes are
 * always fresh (no stale data-processed bookkeeping needed).
 */
export async function renderMermaid(container) {
  const nodes = container.querySelectorAll('pre.mermaid')
  await Promise.all(
    Array.from(nodes).map(async (node) => {
      const code = node.textContent.trim() // browser-decoded raw diagram source
      if (!code) return
      const id = `mmd-${counter++}`
      try {
        const parsed = await mermaid.parse(code, { suppressErrors: true })
        if (parsed === false) throw new Error('Invalid Mermaid syntax')
        const { svg, bindFunctions } = await mermaid.render(id, code)
        const wrapper = document.createElement('div')
        wrapper.className = 'mermaid-rendered'
        wrapper.innerHTML = svg
        node.replaceWith(wrapper)
        bindFunctions?.(wrapper)
      } catch (err) {
        document.getElementById(id)?.remove()
        document.getElementById('d' + id)?.remove()
        const box = document.createElement('div')
        box.className = 'mermaid-error'
        box.setAttribute('role', 'alert')
        const title = document.createElement('strong')
        title.textContent = '圖表錯誤'
        const detail = document.createElement('pre')
        detail.textContent = (err?.message ?? String(err)) + '\n\n' + code
        box.append(title, detail)
        node.replaceWith(box)
      }
    })
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mermaid.js
git commit -m "feat: per-diagram mermaid rendering with error isolation"
```

---

## Task 6: Wire it together (`main.js`) + web verification

**Files:**
- Modify: `src/main.js` (replace the stub)

- [ ] **Step 1: Replace `src/main.js`**

```js
import './style.css'
import { render } from './renderer.js'
import { renderMermaid } from './mermaid.js'
import { createEditor } from './editor.js'
import { loadDraft, saveDraft } from './storage.js'

const DEFAULT_DOC = `# 歡迎使用 mdeditor

支援 **GFM**、語法高亮與 mermaid。

| 功能 | 狀態 |
| --- | --- |
| 表格 | OK |
| 刪除線 | ~~OK~~ |

- [x] 即時預覽
- [ ] 試試編輯我

\`\`\`js
const greet = (name) => \`hi \${name}\`;
\`\`\`

\`\`\`mermaid
graph TD;
  A[編輯] --> B[預覽];
  B --> C[Mermaid];
\`\`\`
`

const editorEl = document.querySelector('#editor')
const previewEl = document.querySelector('#preview')

async function update(text) {
  previewEl.innerHTML = render(text)
  await renderMermaid(previewEl)
  saveDraft(text)
}

const editor = createEditor(editorEl, {
  onChange: (text) => { update(text) },
})

// Restore the saved draft, or show the default doc on first run.
const initial = loadDraft() || DEFAULT_DOC
editor.setValue(initial)
update(initial)
```

- [ ] **Step 2: Verify all rendering features in the browser**

Run: `npm run dev`, open `http://localhost:1420/`. Confirm, with the default document shown:
- The heading, **bold**, and the GFM table render on the right.
- `~~OK~~` shows struck-through.
- The two task-list items show checkboxes (one checked).
- The JS code block is syntax-highlighted (colored tokens).
- The mermaid `graph TD` renders as a flowchart (3 boxes).
- Type into the left pane → the right pane updates after a short pause.
- Break the mermaid diagram (e.g. type `graph XX;;;`) → a red "圖表錯誤" box appears, the rest of the page still renders.
- Reload the page → your edited content is restored (autosave works).

Stop the server (Ctrl+C).

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — renderer (8), storage (3), editor (2) all green.

- [ ] **Step 4: Commit**

```bash
git add src/main.js
git commit -m "feat: wire editor, preview, mermaid, and autosave"
```

---

## Task 7: Tauri v2 desktop integration

**Files:**
- Create: `scripts/make-icon.cjs`, `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `src-tauri/.gitignore`
- Generated (not committed): `src-tauri/icons/*`, `src-tauri/gen/*`

- [ ] **Step 1: Install the Tauri CLI and plugins (npm side)**

Run:
```bash
npm install --save-dev @tauri-apps/cli@^2
npm install @tauri-apps/plugin-dialog@^2 @tauri-apps/plugin-fs@^2
```
Expected: `@tauri-apps/cli` 2.11.x in devDependencies; the two plugin packages (2.7.x / 2.5.x) in dependencies.

- [ ] **Step 2: Create `src-tauri/Cargo.toml`**

```toml
[package]
name = "app"
version = "0.1.0"
description = "mdeditor"
authors = ["you"]
edition = "2021"
rust-version = "1.77.2"

# Lib crate name is package-name + "_lib" => "app_lib"; main.rs calls app_lib::run().
[lib]
name = "app_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2.6.2", features = [] }

[dependencies]
tauri = { version = "2.11.2", features = [] }
tauri-plugin-dialog = "2"   # resolves to 2.7.x
tauri-plugin-fs = "2"       # resolves to 2.5.x
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

- [ ] **Step 3: Create `src-tauri/build.rs`** (required — embeds config/capabilities/icons)

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 4: Create `src-tauri/src/lib.rs`** (the real entry; registers plugins)

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5: Create `src-tauri/src/main.rs`** (thin desktop shim)

```rust
// Prevents an extra console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    app_lib::run();
}
```

- [ ] **Step 6: Create `src-tauri/tauri.conf.json`** (v2; points at the Vite frontend on port 1420)

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "mdeditor",
  "version": "0.1.0",
  "identifier": "tw.hnet.ai.mdeditor",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "mdeditor",
        "width": 1200,
        "height": 800,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null,
      "capabilities": ["default"]
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

- [ ] **Step 7: Create `src-tauri/capabilities/default.json`** (permissions)

`dialog:default` grants open + save; the fs read/write text-file commands are NOT in `fs:default`, so they are listed explicitly. No static `fs:scope` is needed: when the user picks a path via the dialog, Tauri injects that exact path into the fs scope at runtime, so `readTextFile`/`writeTextFile` on the picked absolute path is permitted for the session.

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Main window: markdown open/save + read/write text file",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file"
  ]
}
```

> The `$schema` path points at a file generated on the first build under `src-tauri/gen/`; an editor "missing schema" warning before that first run is expected, not an error.

- [ ] **Step 8: Create `src-tauri/.gitignore`** (ignore Rust build + generated dirs)

```gitignore
/target
/gen
```

- [ ] **Step 9: Create `scripts/make-icon.cjs`** (offline 1024×1024 source PNG generator)

```js
// Writes a 1024x1024 solid-color PNG to src-tauri/app-icon.png using only
// Node built-ins, so the Tauri CLI can generate the full icon set offline.
const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

const W = 1024, H = 1024
const RGB = [37, 99, 235] // blue

const crcTable = (() => {
  const t = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4)
ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0 // 8-bit RGB

const rowLen = 1 + W * 3
const raw = Buffer.alloc(rowLen * H)
for (let y = 0; y < H; y++) {
  const off = y * rowLen
  raw[off] = 0 // filter: none
  for (let x = 0; x < W; x++) {
    const p = off + 1 + x * 3
    raw[p] = RGB[0]; raw[p + 1] = RGB[1]; raw[p + 2] = RGB[2]
  }
}
const idat = zlib.deflateSync(raw)
const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])

const out = path.join(__dirname, '..', 'src-tauri', 'app-icon.png')
fs.writeFileSync(out, png)
console.log('wrote', out)
```

- [ ] **Step 10: Generate the app icons**

Run:
```bash
node scripts/make-icon.cjs
npm run tauri icon src-tauri/app-icon.png
```
Expected: `node` prints `wrote .../src-tauri/app-icon.png`; the CLI generates `src-tauri/icons/` containing `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`, and platform PNGs.

- [ ] **Step 11: Verify the desktop app runs**

Run: `npm run tauri:dev`
Expected: the first run compiles the Rust crates (slow — several minutes), then a native 1200×800 window titled "mdeditor" opens showing the same editor + live preview as the web version (default doc, working mermaid, highlight, GFM). The `src-tauri/gen/` directory is now generated. Close the window to stop.

- [ ] **Step 12: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/build.rs src-tauri/src/main.rs src-tauri/src/lib.rs \
  src-tauri/tauri.conf.json src-tauri/capabilities/default.json src-tauri/.gitignore \
  src-tauri/icons scripts/make-icon.cjs package.json package-lock.json
git commit -m "feat: wrap frontend as a Tauri v2 desktop app with dialog+fs plugins"
```

---

## Task 8: File operations (`files.js`) + toolbar/shortcut wiring

**Files:**
- Create: `src/files.js`
- Test: `src/files.test.js`
- Modify: `src/main.js`

- [ ] **Step 1: Write the failing test** (pure helpers only)

`src/files.test.js`:
```js
import { describe, it, expect, afterEach } from 'vitest'
import { isTauri, basename } from './files.js'

afterEach(() => { delete window.__TAURI_INTERNALS__; delete window.__TAURI__ })

describe('isTauri', () => {
  it('is false in a plain web context', () => {
    expect(isTauri()).toBe(false)
  })
  it('is true when Tauri internals are present', () => {
    window.__TAURI_INTERNALS__ = {}
    expect(isTauri()).toBe(true)
  })
})

describe('basename', () => {
  it('extracts the file name from a windows path', () => {
    expect(basename('C:\\\\docs\\\\note.md')).toBe('note.md')
  })
  it('extracts the file name from a posix path', () => {
    expect(basename('/home/u/note.md')).toBe('note.md')
  })
  it('returns the input when there is no separator', () => {
    expect(basename('note.md')).toBe('note.md')
  })
  it('falls back to a default for null', () => {
    expect(basename(null)).toBe('untitled.md')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- files`
Expected: FAIL — cannot resolve `./files.js`.

- [ ] **Step 3: Implement `src/files.js`**

Tauri plugin modules are dynamically imported only inside the Tauri branch, so the web build never bundles them and tests never load them.

```js
export function isTauri() {
  return typeof window !== 'undefined' &&
    !!(window.__TAURI_INTERNALS__ || window.__TAURI__)
}

export function basename(p) {
  if (!p) return 'untitled.md'
  const parts = p.split(/[\\/]/)
  return parts[parts.length - 1] || 'untitled.md'
}

const MD_FILTER = [{ name: 'Markdown', extensions: ['md', 'markdown'] }]

// Returns { path, content } or null if cancelled.
export async function openFile() {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const { readTextFile } = await import('@tauri-apps/plugin-fs')
    const path = await open({ multiple: false, directory: false, filters: MD_FILTER })
    if (path === null) return null
    const content = await readTextFile(path)
    return { path, content }
  }
  // Web fallback: <input type=file>
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.md,.markdown,text/markdown'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      resolve({ path: file.name, content: await file.text() })
    }
    input.click()
  })
}

// Save to a known path (no dialog). If path is falsy, behaves like saveFileAs.
// Returns the path saved to, or null if cancelled.
export async function saveFile(path, content) {
  if (!path) return saveFileAs(content)
  if (isTauri()) {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    await writeTextFile(path, content)
    return path
  }
  // Web has no silent overwrite — fall back to a download.
  return webDownload(content, basename(path))
}

// Prompt for a destination. Returns the chosen path, or null if cancelled.
export async function saveFileAs(content, suggestedName = 'untitled.md') {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    const path = await save({ defaultPath: suggestedName, filters: MD_FILTER })
    if (path === null) return null
    await writeTextFile(path, content)
    return path
  }
  return webDownload(content, suggestedName)
}

function webDownload(content, name) {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
  return name
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- files`
Expected: PASS — isTauri (2) + basename (4) green.

- [ ] **Step 5: Wire file ops into `src/main.js`**

Replace the contents of `src/main.js` with the version below (adds file state, toolbar handlers, keyboard shortcuts, and a title/status indicator; keeps the render/autosave logic from Task 6).

```js
import './style.css'
import { render } from './renderer.js'
import { renderMermaid } from './mermaid.js'
import { createEditor } from './editor.js'
import { loadDraft, saveDraft } from './storage.js'
import { openFile, saveFile, saveFileAs, basename } from './files.js'

const DEFAULT_DOC = `# 歡迎使用 mdeditor

支援 **GFM**、語法高亮與 mermaid。

| 功能 | 狀態 |
| --- | --- |
| 表格 | OK |
| 刪除線 | ~~OK~~ |

- [x] 即時預覽
- [ ] 試試編輯我

\`\`\`js
const greet = (name) => \`hi \${name}\`;
\`\`\`

\`\`\`mermaid
graph TD;
  A[編輯] --> B[預覽];
  B --> C[Mermaid];
\`\`\`
`

const editorEl = document.querySelector('#editor')
const previewEl = document.querySelector('#preview')
const statusEl = document.querySelector('#status')

let currentPath = null
let dirty = false

function setStatus() {
  const name = currentPath ? basename(currentPath) : '未命名'
  statusEl.textContent = `${name}${dirty ? ' •' : ''}`
}

async function renderPreview(text) {
  previewEl.innerHTML = render(text)
  await renderMermaid(previewEl)
}

const editor = createEditor(editorEl, {
  onChange: (text) => {
    dirty = true
    setStatus()
    saveDraft(text)
    renderPreview(text)
  },
})

function loadContent(text, path) {
  editor.setValue(text)
  currentPath = path ?? null
  dirty = false
  setStatus()
  saveDraft(text)
  renderPreview(text)
}

// --- Toolbar actions ---
async function doNew() {
  loadContent('', null)
}
async function doOpen() {
  const result = await openFile()
  if (result) loadContent(result.content, result.path)
}
async function doSave() {
  const saved = await saveFile(currentPath, editor.getValue())
  if (saved) { currentPath = saved; dirty = false; setStatus() }
}
async function doSaveAs() {
  const suggested = currentPath ? basename(currentPath) : 'untitled.md'
  const saved = await saveFileAs(editor.getValue(), suggested)
  if (saved) { currentPath = saved; dirty = false; setStatus() }
}

document.querySelector('#btn-new').addEventListener('click', doNew)
document.querySelector('#btn-open').addEventListener('click', doOpen)
document.querySelector('#btn-save').addEventListener('click', doSave)
document.querySelector('#btn-saveas').addEventListener('click', doSaveAs)

// --- Keyboard shortcuts ---
window.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return
  const k = e.key.toLowerCase()
  if (k === 'n') { e.preventDefault(); doNew() }
  else if (k === 'o') { e.preventDefault(); doOpen() }
  else if (k === 's' && e.shiftKey) { e.preventDefault(); doSaveAs() }
  else if (k === 's') { e.preventDefault(); doSave() }
})

// --- Boot: restore draft or show the default doc ---
const initial = loadDraft() || DEFAULT_DOC
editor.setValue(initial)
setStatus()
renderPreview(initial)
```

- [ ] **Step 6: Verify file operations**

Run: `npm run tauri:dev`. In the desktop window:
- `Ctrl+O` (or 開啟) → pick a `.md` file → its content loads, status shows the filename.
- Edit → status shows a `•` dirty marker.
- `Ctrl+S` (or 存檔) → file is written in place (no dialog); the `•` clears. Re-open it to confirm the edit persisted.
- `Ctrl+Shift+S` (or 另存為) → choose a new path → it saves and the status updates.
- `Ctrl+N` (or 新建) → editor clears, status shows "未命名".

Then run `npm run dev` and confirm the web fallback: 開啟 shows the OS file picker; 存檔/另存為 trigger a `.md` download. Stop the servers.

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: PASS — renderer (8), storage (3), editor (2), files (6).

- [ ] **Step 8: Commit**

```bash
git add src/files.js src/files.test.js src/main.js
git commit -m "feat: file open/save/save-as with Tauri native + web fallback"
```

---

## Task 9: Polish + README + final verification

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# mdeditor

A KISS markdown editor with live split-pane preview — runs as a web app (Vite) and a desktop app (Tauri v2).

## Features
- Live split-pane editing with GitHub Flavored Markdown (tables, strikethrough, task lists, autolinks)
- Syntax highlighting (highlight.js)
- Mermaid diagrams with per-diagram error isolation
- File new/open/save/save-as (`Ctrl+N` / `Ctrl+O` / `Ctrl+S` / `Ctrl+Shift+S`)
- Autosave of the current draft to localStorage (restored on next launch)

## Develop
- `npm run dev` — web app at http://localhost:1420
- `npm run tauri:dev` — desktop window (requires Rust toolchain)
- `npm test` — unit tests (Vitest)

## Build
- `npm run build` — static web build to `dist/`
- `npm run tauri:build` — desktop installers

## Requirements
- Node.js + npm
- For the desktop app: Rust toolchain and (Windows) WebView2.
```

- [ ] **Step 2: Final full verification**

Run each and confirm:
- `npm test` → all suites pass (renderer 8, storage 3, editor 2, files 6).
- `npm run build` → completes, emits `dist/`.
- `npm run dev` → web app renders the default doc with working mermaid/highlight/GFM; edit + reload restores content.
- `npm run tauri:dev` → desktop window opens; open/save/save-as/new all work.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** split-pane live preview (Task 6) ✓; GFM tables/strikethrough/task-lists/linkify (Task 2) ✓; highlight.js (Task 2) ✓; mermaid + error handling (Tasks 2/5) ✓; new/open/save/save-as + shortcuts (Task 8) ✓; localStorage autosave/restore (Tasks 3/6) ✓; Tauri desktop + web modes (Task 7, web fallback Task 8) ✓; `html:false` safety, mermaid `securityLevel:'strict'` (Tasks 2/5) ✓; Vitest tests for renderer + storage, plus editor + files (Tasks 2/3/4/8) ✓; npm scripts (Task 1/7) ✓.
- **Placeholder scan:** every code step contains full, runnable code; no TBD/TODO/"handle errors" hand-waving.
- **Type/name consistency:** `render`, `renderMermaid`, `createEditor`, `loadDraft`/`saveDraft`, `openFile`/`saveFile`/`saveFileAs`/`isTauri`/`basename` are defined once and referenced consistently across tasks; the Rust lib crate `app_lib` matches `app_lib::run()` in `main.rs`; port 1420 matches across `vite.config.js` and `tauri.conf.json`.
```
