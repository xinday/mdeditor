# 匯出功能（HTML / PDF）實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓編輯器能把目前文件匯出成自包含 HTML 單檔，以及透過系統列印對話框輸出 PDF。

**Architecture:** HTML 匯出與 PDF 列印共用同一個純函式 `buildStandaloneHtml()`，它把即時預覽 DOM（`previewEl.innerHTML`，mermaid 已是內嵌 SVG）包進一份內嵌 CSS 的 `<!DOCTYPE html>` 文件。HTML 走檔案下載/儲存；PDF 把同一份文件載入隱藏 iframe 後呼叫 `print()`，以隔離 app 的分割視窗版面、確保完整分頁。

**Tech Stack:** Vanilla ES modules、Vite 8（CSS 以 `?inline` 取得字串）、Vitest 4 + jsdom、markdown-it/highlight.js/mermaid（既有）、Tauri v2 plugin-dialog/plugin-fs（既有）。

## Global Constraints

- **不新增任何 npm 相依套件**（HTML 用字串模板、PDF 用 `window.print()`、CSS 用 Vite `?inline`）。
- **不新增任何 Tauri 權限**（HTML 為文字檔，沿用既有 `fs:allow-write-text-file`；列印不觸及檔案系統）。
- **`files.js` 仍是唯一做平台分支（`isTauri()`）的模組**，新增函式遵循同一動態 import 模式。
- **匯出 body 一律取自即時 `previewEl.innerHTML`**，不可改用 `render(text)`（後者 mermaid 尚未渲染）。
- **source-line 0-based 不變量不受影響**：匯出只讀 DOM，不參與捲動邏輯。
- 預覽容器 `#preview` 已帶 class `markdown-body`；文件樣式一律以 `.markdown-body` 為選擇器，讓預覽與匯出外觀一致。
- commit message 格式：`<type>: <繁體中文描述>`，並以 `Co-Authored-By` 結尾。

---

## File Structure

- **`src/export.css`**（新增）— `.markdown-body` 文件樣式表 + `@media print` 分頁規則。自我完備，不依賴 `style.css` 的 CSS 變數（匯出檔只內嵌這一份）。
- **`src/exporter.js`**（新增）— `buildStandaloneHtml()`（純函式）與 `printHtml()`（DOM 副作用）。**不** import 任何 CSS，保持可單元測試。
- **`src/export-styles.js`**（新增）— 以 `?inline` 把 `export.css` 與 highlight.js github 主題讀成字串，匯出 `EXPORT_STYLES`。建置期 asset，測試不會 import 它。
- **`src/exporter.test.js`**（新增）— `buildStandaloneHtml` 與 `printHtml` 的單元測試。
- **`src/files.js`**（修改）— 新增 `exportTextFile()`；`webDownload()` 加上可選 `mime` 參數。
- **`src/files.test.js`**（修改）— 新增 `exportTextFile` web 分支測試。
- **`src/main.js`**（修改）— import `export.css`、接線「匯出 ▾」下拉與 HTML/列印動作。
- **`index.html`**（修改）— 工具列新增「匯出 ▾」下拉標記。
- **`src/style.css`**（修改）— 下拉選單樣式；把 `#preview` 的內容樣式（pre/table/mermaid-error）移交給 `export.css`。

---

## Task 1: 文件樣式表 `export.css` 並套用到即時預覽

**Files:**
- Create: `src/export.css`
- Modify: `src/style.css:26-34`（移除 `#preview pre`、`#preview table`、`#preview th/td`、`.mermaid-error` 內容樣式）
- Modify: `src/main.js:1`（新增 `import './export.css'`）

**Interfaces:**
- Consumes: 無
- Produces: 一份以 `.markdown-body` 為選擇器的樣式表，供 Task 3（預覽外觀）與 export-styles（Task 5）內嵌使用。

> 本任務為樣式/版面，jsdom 無 layout 故**不寫單元測試**（與專案「幾何/CSS 由瀏覽器驗證」慣例一致）。驗證方式為建置成功 + 瀏覽器目視。

- [ ] **Step 1: 建立 `src/export.css`**

```css
/* 已渲染 Markdown 本體的文件樣式。由即時預覽（#preview.markdown-body）與
   匯出/列印的自包含 HTML 共用，確保兩者外觀一致。
   自我完備：不使用 style.css 的變數，因為匯出檔只內嵌這一份樣式。 */

.markdown-body {
  max-width: 860px;
  margin: 0 auto;
  color: #1f2328;
  font-family: system-ui, "Segoe UI", "PingFang TC", "Microsoft JhengHei", sans-serif;
  font-size: 16px;
  line-height: 1.6;
  word-wrap: break-word;
}

.markdown-body > *:first-child { margin-top: 0; }
.markdown-body > *:last-child { margin-bottom: 0; }

.markdown-body h1, .markdown-body h2, .markdown-body h3,
.markdown-body h4, .markdown-body h5, .markdown-body h6 {
  margin: 1.5em 0 0.6em;
  font-weight: 600;
  line-height: 1.25;
}
.markdown-body h1 { font-size: 1.9em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
.markdown-body h2 { font-size: 1.5em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
.markdown-body h3 { font-size: 1.25em; }
.markdown-body h4 { font-size: 1em; }
.markdown-body h5 { font-size: 0.9em; }
.markdown-body h6 { font-size: 0.85em; color: #656d76; }

.markdown-body p, .markdown-body ul, .markdown-body ol,
.markdown-body blockquote, .markdown-body table, .markdown-body pre {
  margin: 0 0 1em;
}

.markdown-body a { color: #0969da; text-decoration: none; }
.markdown-body a:hover { text-decoration: underline; }

.markdown-body code {
  font-family: ui-monospace, "SFMono-Regular", "Consolas", monospace;
  font-size: 0.9em;
  background: #eff1f3;
  padding: 0.15em 0.35em;
  border-radius: 4px;
}
.markdown-body pre {
  background: #f6f8fa;
  padding: 12px 14px;
  border-radius: 6px;
  overflow: auto;
}
.markdown-body pre code {
  background: transparent;
  padding: 0;
  font-size: 0.875em;
}

.markdown-body blockquote {
  margin-left: 0;
  padding: 0 1em;
  color: #656d76;
  border-left: 4px solid #d0d7de;
}

.markdown-body ul, .markdown-body ol { padding-left: 1.6em; }
.markdown-body li + li { margin-top: 0.25em; }

.markdown-body .task-list-item { list-style: none; }
.markdown-body .task-list-item input { margin: 0 0.4em 0 -1.4em; vertical-align: middle; }

.markdown-body table {
  border-collapse: collapse;
  display: block;
  width: max-content;
  max-width: 100%;
  overflow: auto;
}
.markdown-body th, .markdown-body td {
  border: 1px solid #d0d7de;
  padding: 6px 12px;
}
.markdown-body th { background: #f6f8fa; font-weight: 600; }
.markdown-body tr:nth-child(2n) td { background: #f6f8fa; }

.markdown-body img { max-width: 100%; height: auto; }
.markdown-body hr { border: 0; border-top: 1px solid #d0d7de; margin: 1.5em 0; }

.markdown-body .mermaid-rendered { margin: 0 0 1em; text-align: center; }
.markdown-body .mermaid-rendered svg { max-width: 100%; height: auto; }

.mermaid-error {
  border: 1px solid #e11d48; background: #fff1f2; color: #9f1239;
  padding: 0.75rem 1rem; border-radius: 6px; font-size: 0.85rem;
}
.mermaid-error pre {
  margin: 0.5rem 0 0; white-space: pre-wrap; word-break: break-word; background: transparent;
}

@media print {
  @page { margin: 18mm; }
  .markdown-body { max-width: none; margin: 0; font-size: 12pt; }
  .markdown-body a { color: inherit; }
  .markdown-body pre, .markdown-body blockquote, .markdown-body table,
  .markdown-body .mermaid-rendered, .markdown-body img { break-inside: avoid; }
  .markdown-body h1, .markdown-body h2, .markdown-body h3,
  .markdown-body h4, .markdown-body h5, .markdown-body h6 { break-after: avoid; }
}
```

- [ ] **Step 2: 從 `style.css` 移除已移交的內容樣式**

把 `src/style.css` 第 26-34 行這幾條（現由 `export.css` 以 `.markdown-body` 接手）刪除：

```css
#preview pre { background: #f6f8fa; padding: 12px; border-radius: 6px; overflow: auto; }
#preview table { border-collapse: collapse; }
#preview th, #preview td { border: 1px solid var(--border); padding: 6px 12px; }

.mermaid-error {
  border: 1px solid #e11d48; background: #fff1f2; color: #9f1239;
  padding: 0.75rem 1rem; border-radius: 6px; font-size: 0.85rem;
}
.mermaid-error pre { margin: 0.5rem 0 0; white-space: pre-wrap; word-break: break-word; background: transparent; }
```

保留 `#preview { padding: 16px 24px; overflow: auto; }`（第 25 行，屬容器版面，不動）。刪除後 `style.css` 在 `#preview { ... }` 之後直接結束。

- [ ] **Step 3: 在 `main.js` 匯入 `export.css`**

把 `src/main.js` 第 1 行：

```javascript
import './style.css'
```

改為：

```javascript
import './style.css'
import './export.css'
```

- [ ] **Step 4: 確認既有測試與建置未被破壞**

Run: `npm test`
Expected: 全數 PASS（本任務未改任何測試覆蓋的邏輯）。

Run: `npm run build`
Expected: 建置成功，無錯誤，輸出至 `dist/`。

- [ ] **Step 5: 瀏覽器目視驗證**

Run: `npm run dev`，開 http://localhost:1420
Expected: 預覽區的標題、表格（含斑馬列）、程式碼區塊、引用、清單、任務清單核取方塊、mermaid 圖都正常顯示，內容置中且最大寬度約 860px。

- [ ] **Step 6: Commit**

```bash
git add src/export.css src/style.css src/main.js
git commit -m "$(cat <<'EOF'
feat: 新增 .markdown-body 文件樣式表並套用到預覽

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `buildStandaloneHtml()` 產生自包含 HTML 文件

**Files:**
- Create: `src/exporter.js`
- Test: `src/exporter.test.js`

**Interfaces:**
- Consumes: 無
- Produces: `buildStandaloneHtml({ title: string, bodyHtml: string, styles?: string }) => string`，從 `./exporter.js` 匯出。回傳完整 `<!doctype html>` 文件字串，body 以 `<article class="markdown-body">` 包住 `bodyHtml`，`styles` 內嵌於 `<style>`，`title` 經 HTML 跳脫，未給 title 時為 `untitled`。

- [ ] **Step 1: 寫失敗測試**

建立 `src/exporter.test.js`：

```javascript
import { describe, it, expect } from 'vitest'
import { buildStandaloneHtml } from './exporter.js'

describe('buildStandaloneHtml', () => {
  it('wraps the body in a standalone HTML document', () => {
    const html = buildStandaloneHtml({ title: 'Note', bodyHtml: '<h1>Hi</h1>', styles: '' })
    expect(html).toMatch(/^<!doctype html>/i)
    expect(html).toContain('<title>Note</title>')
    expect(html).toContain('<article class="markdown-body">')
    expect(html).toContain('<h1>Hi</h1>')
  })

  it('inlines the provided styles in a <style> block', () => {
    const html = buildStandaloneHtml({ title: 't', bodyHtml: '', styles: '.marker{color:red}' })
    expect(html).toContain('<style>')
    expect(html).toContain('.marker{color:red}')
  })

  it('escapes the title to keep the document well-formed', () => {
    const html = buildStandaloneHtml({ title: 'a<b>&"', bodyHtml: '', styles: '' })
    expect(html).toContain('<title>a&lt;b&gt;&amp;&quot;</title>')
    expect(html).not.toContain('<title>a<b>')
  })

  it('falls back to "untitled" when no title is given', () => {
    const html = buildStandaloneHtml({ title: '', bodyHtml: '', styles: '' })
    expect(html).toContain('<title>untitled</title>')
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/exporter.test.js`
Expected: FAIL，訊息類似 `Failed to resolve import "./exporter.js"` 或 `buildStandaloneHtml is not a function`。

- [ ] **Step 3: 實作 `buildStandaloneHtml`**

建立 `src/exporter.js`：

```javascript
// 把已渲染的預覽內容包成一份自包含 HTML 文件。HTML 匯出與 PDF 列印共用此函式。
// styles 由呼叫端傳入（見 export-styles.js），讓本模組保持無 CSS import、可單元測試。

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ))
}

export function buildStandaloneHtml({ title, bodyHtml, styles = '' }) {
  const t = escapeHtml(title || 'untitled')
  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${t}</title>
<style>
${styles}
</style>
</head>
<body>
<article class="markdown-body">
${bodyHtml ?? ''}
</article>
</body>
</html>
`
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/exporter.test.js`
Expected: PASS（4 個 buildStandaloneHtml 測試全綠）。

- [ ] **Step 5: Commit**

```bash
git add src/exporter.js src/exporter.test.js
git commit -m "$(cat <<'EOF'
feat: 新增 buildStandaloneHtml 產生自包含匯出 HTML

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `printHtml()` 以隱藏 iframe 列印

**Files:**
- Modify: `src/exporter.js`（新增 `printHtml`）
- Test: `src/exporter.test.js`（新增 `printHtml` describe 區塊）

**Interfaces:**
- Consumes: 無
- Produces: `printHtml(html: string) => HTMLIFrameElement`，從 `./exporter.js` 匯出。建立隱藏 iframe（class `export-print-frame`）、以 `srcdoc` 載入 html、附加到 `document.body` 並回傳；iframe `load` 後對其 `contentWindow` 呼叫 `focus()` 與 `print()`，並在 `afterprint` 時移除 iframe。

- [ ] **Step 1: 寫失敗測試**

在 `src/exporter.test.js` 頂部 import 加入 `vi, afterEach`，並把 import 來源加上 `printHtml`：

```javascript
import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildStandaloneHtml, printHtml } from './exporter.js'
```

在檔案結尾新增：

```javascript
describe('printHtml', () => {
  afterEach(() => {
    document.querySelectorAll('iframe.export-print-frame').forEach((f) => f.remove())
  })

  it('appends a hidden iframe carrying the html and returns it', () => {
    const html = '<!doctype html><title>t</title>'
    const iframe = printHtml(html)
    expect(iframe.tagName).toBe('IFRAME')
    expect(iframe.getAttribute('srcdoc')).toBe(html)
    expect(document.body.contains(iframe)).toBe(true)
    expect(iframe.style.position).toBe('fixed')
  })

  it('prints the iframe and removes it after printing', () => {
    const iframe = printHtml('<!doctype html>')
    const print = vi.fn()
    const focus = vi.fn()
    let afterprintCb = null
    const fakeWin = {
      focus,
      print,
      addEventListener: (type, cb) => { if (type === 'afterprint') afterprintCb = cb },
    }
    Object.defineProperty(iframe, 'contentWindow', { value: fakeWin, configurable: true })
    iframe.dispatchEvent(new Event('load'))
    expect(focus).toHaveBeenCalled()
    expect(print).toHaveBeenCalledTimes(1)
    expect(document.body.contains(iframe)).toBe(true)
    afterprintCb()
    expect(document.body.contains(iframe)).toBe(false)
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/exporter.test.js -t printHtml`
Expected: FAIL，`printHtml is not a function`。

- [ ] **Step 3: 實作 `printHtml`**

在 `src/exporter.js` 結尾新增：

```javascript
// 把一份自包含 HTML 載入隱藏 iframe 再列印，避免 app 的分割視窗版面干擾分頁。
// 內容全部內嵌（CSS、mermaid SVG），故載入近乎即時。回傳 iframe（便於測試）。
export function printHtml(html) {
  const iframe = document.createElement('iframe')
  iframe.className = 'export-print-frame'
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed; right:0; bottom:0; width:0; height:0; border:0;'
  iframe.srcdoc = html
  iframe.addEventListener('load', () => {
    const win = iframe.contentWindow
    if (!win) return
    win.addEventListener('afterprint', () => iframe.remove(), { once: true })
    win.focus()
    win.print()
  })
  document.body.appendChild(iframe)
  return iframe
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/exporter.test.js`
Expected: PASS（buildStandaloneHtml 4 個 + printHtml 2 個）。

> 註：jsdom 可能在測試結束後非同步觸發 iframe 的真實 `load`，呼叫未實作的 `window.print`，僅在虛擬 console 印出 "Not implemented" 警告，無害；`if (!win) return` 守衛確保 iframe 移除後不再動作。

- [ ] **Step 5: Commit**

```bash
git add src/exporter.js src/exporter.test.js
git commit -m "$(cat <<'EOF'
feat: 新增 printHtml 以隔離 iframe 進行列印/PDF

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `files.js` 新增 `exportTextFile()`

**Files:**
- Modify: `src/files.js:65-74`（`webDownload` 加 `mime` 參數）、檔尾新增 `exportTextFile`
- Test: `src/files.test.js`（新增 web 分支測試）

**Interfaces:**
- Consumes: `isTauri()`、`webDownload()`（同檔內）
- Produces: `exportTextFile(content: string, suggestedName: string, opts: { name: string, extensions: string[], mime: string }) => Promise<string | null>`，從 `./files.js` 匯出。Tauri：開存檔對話框並 `writeTextFile`，取消回傳 `null`；web：以 `mime` 下載 Blob，回傳檔名。

- [ ] **Step 1: 寫失敗測試**

修改 `src/files.test.js` 第 1-2 行的 import：

```javascript
import { describe, it, expect, afterEach, vi } from 'vitest'
import { isTauri, basename, exportTextFile } from './files.js'
```

在 `basename` 的 `describe` 之後新增：

```javascript
describe('exportTextFile (web)', () => {
  let origCreate, origRevoke, clickSpy
  afterEach(() => {
    URL.createObjectURL = origCreate
    URL.revokeObjectURL = origRevoke
    clickSpy?.mockRestore()
  })

  it('downloads a blob with the given mime and name, and returns the name', async () => {
    origCreate = URL.createObjectURL
    origRevoke = URL.revokeObjectURL
    let captured = null
    URL.createObjectURL = vi.fn((blob) => { captured = blob; return 'blob:fake' })
    URL.revokeObjectURL = vi.fn()
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const name = await exportTextFile('<h1>hi</h1>', 'doc.html', {
      name: 'HTML', extensions: ['html'], mime: 'text/html',
    })

    expect(name).toBe('doc.html')
    expect(captured).toBeInstanceOf(Blob)
    expect(captured.type).toBe('text/html')
    expect(await captured.text()).toBe('<h1>hi</h1>')
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/files.test.js -t exportTextFile`
Expected: FAIL，`exportTextFile is not a function`。

- [ ] **Step 3: 實作**

把 `src/files.js` 的 `webDownload`（第 65-74 行）改為接受可選 `mime`：

```javascript
function webDownload(content, name, mime = 'text/markdown') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
  return name
}
```

在 `webDownload` 之前（或 `saveFileAs` 之後）新增 `exportTextFile`：

```javascript
// 以自訂副檔名/MIME 儲存任意文字內容。Tauri 顯示存檔對話框並寫檔；
// web 下載對應 MIME 的 Blob。回傳路徑/檔名，取消回傳 null。
export async function exportTextFile(content, suggestedName, { name, extensions, mime }) {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    const path = await save({ defaultPath: suggestedName, filters: [{ name, extensions }] })
    if (path === null) return null
    await writeTextFile(path, content)
    return path
  }
  return webDownload(content, suggestedName, mime)
}
```

（既有 `saveFile`/`saveFileAs` 呼叫 `webDownload(content, name)` 時 `mime` 預設 `text/markdown`，行為不變，刻意不重構。）

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/files.test.js`
Expected: PASS（既有 isTauri/basename 測試 + 新增 exportTextFile 測試全綠）。

- [ ] **Step 5: Commit**

```bash
git add src/files.js src/files.test.js
git commit -m "$(cat <<'EOF'
feat: files.js 新增 exportTextFile 支援自訂格式儲存

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 接線「匯出 ▾」下拉與動作

**Files:**
- Create: `src/export-styles.js`
- Modify: `index.html:14-15`（工具列新增下拉）
- Modify: `src/style.css`（檔尾新增下拉樣式）
- Modify: `src/main.js`（import 與接線）

**Interfaces:**
- Consumes: `buildStandaloneHtml`、`printHtml`（`./exporter.js`，Task 2/3）、`exportTextFile`、`basename`（`./files.js`，Task 4）、`EXPORT_STYLES`（`./export-styles.js`，本任務）
- Produces: 使用者可見的匯出功能；無對外程式介面。

> 本任務為 DOM 接線/整合（`main.js` 在專案中無單元測試），驗證方式為建置成功 + 瀏覽器手動。

- [ ] **Step 1: 建立 `src/export-styles.js`**

```javascript
// 建置期 asset：把文件樣式與 highlight.js 主題讀成字串，供 buildStandaloneHtml
// 內嵌進匯出檔。Vite 的 ?inline 回傳 CSS 字串而非注入 <style>。
// 此檔不被任何測試 import，故 vitest 不會處理這兩個 ?inline 匯入。
import docCss from './export.css?inline'
import hljsCss from 'highlight.js/styles/github.css?inline'

export const EXPORT_STYLES = `${hljsCss}\n${docCss}`
```

- [ ] **Step 2: 在 `index.html` 新增下拉標記**

把 `index.html` 第 14 行 `<button id="btn-saveas" ...>` 之後、第 15 行 `<span id="status">` 之前，插入：

```html
        <button id="btn-saveas" type="button">另存為</button>
        <div id="export-menu">
          <button id="btn-export" type="button" aria-haspopup="true" aria-expanded="false">匯出 ▾</button>
          <ul id="export-list" hidden>
            <li><button type="button" data-export="html">HTML</button></li>
            <li><button type="button" data-export="print">列印 / PDF</button></li>
          </ul>
        </div>
        <span id="status"></span>
```

（即在既有 `<button id="btn-saveas">` 與 `<span id="status">` 之間加入 `#export-menu` 區塊。）

- [ ] **Step 3: 在 `style.css` 檔尾新增下拉樣式**

於 `src/style.css` 結尾追加：

```css
#export-menu { position: relative; display: inline-flex; }
#export-list {
  position: absolute; top: 100%; left: 0; z-index: 10;
  margin: 4px 0 0; padding: 4px; list-style: none;
  background: #fff; border: 1px solid var(--border); border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); min-width: 140px;
}
#export-list[hidden] { display: none; }
#export-list li { margin: 0; }
#export-list button {
  display: block; width: 100%; text-align: left;
  padding: 6px 10px; border: 0; background: transparent;
  border-radius: 4px; cursor: pointer; font-size: 14px;
}
#export-list button:hover { background: #eef2f7; }
```

- [ ] **Step 4: 在 `main.js` 接線**

(a) 更新 import 區（第 2、6 行附近）。把第 6 行：

```javascript
import { openFile, saveFile, saveFileAs, basename } from './files.js'
```

改為，並在其後新增兩行 import：

```javascript
import { openFile, saveFile, saveFileAs, basename, exportTextFile } from './files.js'
import { buildStandaloneHtml, printHtml } from './exporter.js'
import { EXPORT_STYLES } from './export-styles.js'
```

(b) 在 `doSaveAs`（約第 82-86 行）之後、`document.querySelector('#btn-new')...` 之前，新增匯出動作與下拉控制：

```javascript
// --- Export actions ---
function exportBaseName() {
  const base = currentPath ? basename(currentPath) : 'untitled'
  return base.replace(/\.[^.]+$/, '') || 'untitled'
}
function buildExportHtml() {
  return buildStandaloneHtml({
    title: exportBaseName(),
    bodyHtml: previewEl.innerHTML,
    styles: EXPORT_STYLES,
  })
}
async function doExportHtml() {
  await exportTextFile(buildExportHtml(), `${exportBaseName()}.html`, {
    name: 'HTML', extensions: ['html'], mime: 'text/html',
  })
}
function doPrint() {
  printHtml(buildExportHtml())
}

const exportBtn = document.querySelector('#btn-export')
const exportList = document.querySelector('#export-list')
function closeExportMenu() {
  exportList.hidden = true
  exportBtn.setAttribute('aria-expanded', 'false')
}
exportBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  const willOpen = exportList.hidden
  exportList.hidden = !willOpen
  exportBtn.setAttribute('aria-expanded', String(willOpen))
})
exportList.addEventListener('click', (e) => {
  const action = e.target.closest('[data-export]')?.dataset.export
  if (!action) return
  closeExportMenu()
  if (action === 'html') doExportHtml().catch(console.error)
  else if (action === 'print') doPrint()
})
document.addEventListener('click', closeExportMenu)
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeExportMenu() })
```

- [ ] **Step 5: 既有測試 + 建置驗證**

Run: `npm test`
Expected: 全數 PASS。

Run: `npm run build` 接著 `npm run build:single`
Expected: 兩種建置皆成功（`?inline` 匯入在兩種模式都正常）。

- [ ] **Step 6: 瀏覽器手動驗證**

Run: `npm run dev`，開 http://localhost:1420
Expected:
1. 工具列出現「匯出 ▾」；點擊展開選單、再點外部或按 Esc 會關閉。
2. 點「HTML」→ 瀏覽器下載 `<名稱>.html`；雙擊開啟該檔，標題、程式碼高亮、表格、mermaid 圖（向量 SVG）皆正確，且離線可開（無外部請求）。
3. 點「列印 / PDF」→ 開啟系統列印對話框，預覽顯示**完整文件且正確分頁**（非只有可見區段），選「另存為 PDF」可輸出。

- [ ] **Step 7: Commit**

```bash
git add src/export-styles.js index.html src/style.css src/main.js
git commit -m "$(cat <<'EOF'
feat: 工具列新增匯出下拉，接線 HTML 匯出與 PDF 列印

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 全面驗證

**Files:** 無（僅執行驗證）

**Interfaces:**
- Consumes: 前述所有任務
- Produces: 綠燈的測試與建置、桌面端煙霧測試結果

- [ ] **Step 1: 全測試套件**

Run: `npm test`
Expected: 所有測試 PASS（含新增的 `exporter.test.js` 與 `files.test.js` 的 exportTextFile）。

- [ ] **Step 2: 兩種 web 建置**

Run: `npm run build`
Expected: 成功，輸出 `dist/`。

Run: `npm run build:single`
Expected: 成功，輸出單檔 `dist-single/index.html`。

- [ ] **Step 3: 桌面端煙霧測試（需 Rust 工具鏈）**

Run: `npm run tauri:dev`
Expected:
1. 「匯出 ▾ → HTML」開啟 Tauri 原生存檔對話框，可選路徑並寫出 `.html` 檔；開啟該檔內容正確。
2. 「匯出 ▾ → 列印 / PDF」開啟系統列印對話框（Windows 可選「Microsoft Print to PDF」），輸出完整分頁的 PDF。

> 若當前環境無 Rust 工具鏈，記錄此步驟為「未執行（缺工具鏈）」，並在 web 端（Step 1-2 + Task 5 Step 6）完成驗證即可，不可假稱已驗證。

- [ ] **Step 4: 收尾 commit（若驗證過程有微調）**

```bash
git status
# 若無變更則略過；若有修正：
git add -A
git commit -m "$(cat <<'EOF'
test: 匯出功能驗證後的收尾調整

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## 自我檢查結果（撰寫者已執行）

- **Spec 覆蓋**：HTML 匯出（Task 2+4+5）、PDF 列印 iframe 隔離（Task 3+5）、文件樣式表並改善預覽（Task 1）、`files.js` `exportTextFile` 免二進位權限（Task 4）、下拉 UI（Task 5）、不新增相依/權限（Global Constraints + 各任務）、測試策略（Task 2/3/4 單元；CSS 與整合由建置+瀏覽器驗證，Task 1/5/6）。皆有對應任務。
- **佔位符掃描**：無 TBD/TODO；每個程式步驟都附完整程式碼與預期輸出。
- **型別/命名一致**：`buildStandaloneHtml({title, bodyHtml, styles})`、`printHtml(html)`、`exportTextFile(content, suggestedName, {name, extensions, mime})`、`EXPORT_STYLES`、`export-print-frame`、`#btn-export`/`#export-list`/`data-export` 在各任務間一致。
