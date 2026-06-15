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
