import './style.css'
import { render } from './renderer.js'
import { renderMermaid } from './mermaid.js'
import { createEditor } from './editor.js'
import { loadDraft, saveDraft } from './storage.js'
import { openFile, saveFile, saveFileAs, basename } from './files.js'
import { syncScroll } from './scrollsync.js'

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
  sync.resync()
}

const editor = createEditor(editorEl, {
  onChange: (text) => {
    dirty = true
    setStatus()
    saveDraft(text)
    renderPreview(text).catch(console.error)
  },
})

const sync = syncScroll(editor, previewEl)

function loadContent(text, path) {
  editor.setValue(text)
  currentPath = path ?? null
  dirty = false
  setStatus()
  saveDraft(text)
  renderPreview(text).catch(console.error)
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
renderPreview(initial).catch(console.error)
