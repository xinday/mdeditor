# 匯出功能設計（HTML / PDF）

日期：2026-06-17
狀態：已核准，待寫實作計畫

## 目標

讓編輯器能把目前文件匯出成:

1. **HTML** —— 自包含單檔（CSS 內嵌、mermaid 以內嵌 SVG 保留），雙擊即可離線開啟。
2. **PDF** —— 透過系統列印對話框（使用者選「另存為 PDF」），web 與桌面行為一致。

明確排除（YAGNI）：`.docx`、PNG、深色匯出主題、選取範圍匯出。日後若要加 `.docx`，`buildStandaloneHtml` 的產出正好是其輸入。

## 核心洞察

HTML 匯出與 PDF 列印的內容**完全相同** —— 都是「目前預覽的渲染結果 + 文件樣式表」。差別只在最後一步：HTML 寫成檔案，PDF 丟進列印視窗。因此核心（產生一份自包含 HTML 文件）只實作一次，兩條路徑共用。

關鍵：要擷取的是 **`previewEl.innerHTML`（即時 DOM）**，此時 mermaid 已被 `renderMermaid()` 渲染成內嵌 SVG（位於 `.mermaid-rendered` 區塊）。**不可**改用 `render(text)`，因為那只是 markdown-it 的輸出，mermaid 仍是未渲染的 `<pre class="mermaid">`。

## 架構

```
工具列「匯出 ▾」下拉
  ├─ HTML       → exporter.buildStandaloneHtml({title, bodyHtml}) → files.exportTextFile(...)
  └─ 列印 / PDF → exporter.buildStandaloneHtml({title, bodyHtml}) → exporter.printHtml(html)

bodyHtml 一律取自即時的 previewEl.innerHTML（mermaid 已為內嵌 SVG）
```

### 模組邊界

#### 新模組 `src/exporter.js`

- **`buildStandaloneHtml({ title, bodyHtml }) → string`**（純函式，可單元測試）
  產生完整的 `<!DOCTYPE html>` 文件字串：
  - `<meta charset="utf-8">`、`<meta name="viewport">`
  - 經 HTML 跳脫的 `<title>`
  - **內嵌**的文件樣式表 + highlight.js 的 github 主題 CSS（兩者於建置期以 Vite `?inline` 取得字串）
  - body 以 `<article class="markdown-body">…bodyHtml…</article>` 包住
  - 因為 CSS 內嵌、SVG 內嵌，產物為單檔、離線、無外部相依。

- **`printHtml(html) → void`**（DOM 副作用，小）
  1. 建立隱藏 `<iframe>`（例如 `style.position='fixed'; left/top 移出畫面或 0 尺寸）。
  2. 以 `srcdoc = html` 載入（自包含，載入近乎即時）。
  3. `load` 事件後呼叫 `iframe.contentWindow.print()`。
  4. 列印結束後清除 iframe：優先用 iframe 內 window 的 `afterprint` 事件，並加上逾時備援（例如 1000ms）避免事件未觸發時殘留節點。

  **為何用 iframe 隔離**：app 是分割視窗版面（固定高度、`overflow:auto` 的捲動容器）。若直接對主視窗 `window.print()`，捲動範圍外的內容會被裁切、不分頁，且需要大量脆弱的 `@media print` 覆寫來隱藏編輯區/工具列並解除容器高度限制，螢幕用樣式也會滲漏。iframe 內是一份無 app 版面的乾淨文件，內容自然流動、正確分頁，且與 HTML 匯出共用同一份文件、輸出一致。

#### 新樣式表 `src/export.css`

手寫精簡的 `.markdown-body` 文件樣式，涵蓋：標題（h1–h6）、段落、`pre`/`code`（搭配 highlight.js github 主題）、表格、引用 `blockquote`、有序/無序清單、任務清單、圖片、連結、水平線、mermaid 區塊與 `.mermaid-error`。外加 `@media print` 分頁規則（例如標題避免孤行、`pre`/表格/圖片盡量不跨頁切斷、合理頁邊）。

- 在 `main.js` 以**正常 import** 套用到即時預覽（`#preview` 已帶 `markdown-body` class，順手改善目前陽春的畫面外觀）。
- 在 `exporter.js` 以 **`?inline` import** 取得字串，內嵌進 `buildStandaloneHtml` 的產物。
- 一份來源、兩處受益（畫面與匯出外觀一致）。

#### `src/files.js` 擴充

HTML 為純文字檔，沿用既有的 `writeTextFile`（Tauri）/ Blob 下載（web），**Tauri 端不需要新增權限**。把目前寫死 `MD_FILTER` 的儲存邏輯一般化，新增匯出用函式:

- **`exportTextFile(content, suggestedName, { name, extensions, mime }) → Promise<string|null>`**
  - Tauri 分支：`@tauri-apps/plugin-dialog` 的 `save({ defaultPath: suggestedName, filters: [{ name, extensions }] })` → `@tauri-apps/plugin-fs` 的 `writeTextFile(path, content)`；取消回傳 `null`。
  - web 分支：`new Blob([content], { type: mime })` → anchor 下載（沿用既有 `webDownload` 模式，MIME 改為傳入值），回傳檔名。

  既有 `saveFileAs(content, suggestedName)` 可重構為呼叫此函式並帶入 Markdown 的 filter/MIME，以收斂重複邏輯（屬本次工作範圍內的合理整理，不擴大改動）。

#### `src/main.js` 接線 + UI

- 工具列新增一個 **「匯出 ▾」下拉**（KISS 實作：點擊切換開合、選項觸發動作、點擊外部關閉、Esc 關閉）。項目：
  - **HTML** → `buildStandaloneHtml({title, bodyHtml})` → `exportTextFile(html, "<名稱>.html", { name:'HTML', extensions:['html'], mime:'text/html' })`
  - **列印 / PDF** → `buildStandaloneHtml({title, bodyHtml})` → `printHtml(html)`
  - 預留日後 `.docx` 項目的位置。
- `title` / 檔名由 `basename(currentPath)` 去副檔名而來；未開檔則用 `untitled`。

## 資料流

```
使用者點「匯出 ▾ → HTML」或「列印 / PDF」
  → title = stripExt(basename(currentPath)) || 'untitled'
  → bodyHtml = previewEl.innerHTML          // 即時 DOM，mermaid 已是內嵌 SVG
  → html = buildStandaloneHtml({ title, bodyHtml })
       ├─ HTML：files.exportTextFile(html, `${title}.html`, {html, text/html})
       └─ PDF ：exporter.printHtml(html) → 隱藏 iframe → contentWindow.print()
```

## 錯誤處理

- **空文件** → 仍產生合法的空 HTML 文件。
- **mermaid 壞圖** → 預覽中已是 `.mermaid-error` 區塊，原樣帶進匯出（可接受，呈現錯誤框）。
- **`<title>` 與檔名** → 做 HTML 跳脫，避免破壞文件結構。
- **對話框取消（Tauri/web）** → 靜默返回，與現有 save 行為一致。
- **`printHtml` 清除** → 以 `afterprint` 為主、逾時為備援，確保 iframe 不殘留。

## 測試

- **`buildStandaloneHtml`**（jsdom）：解析輸出，驗證含 `<!DOCTYPE html>`、`title` 已跳脫、含 `<article class="markdown-body">` 包裝、含傳入的 body 內容、含 CSS 內嵌標記（document + highlight.js）。
- **`printHtml`**（jsdom）：stub `iframe.contentWindow.print`，驗證建立 iframe、寫入 `srcdoc`/內容、`load` 後呼叫 `print`、事後移除 iframe。
- **`exportTextFile`（web 分支）**：驗證以正確 MIME（`text/html`）建立 Blob 並觸發下載（沿用既有可 mock 的 anchor 模式）。
- **實際列印外觀／分頁** → 瀏覽器手動驗證（`npm run dev`），與既有 scroll-sync 幾何「不單元測試、瀏覽器驗證」的慣例一致。

## 相依與權限影響

- **不新增 npm 相依**：HTML 由字串模板產生，PDF 由 `window.print()` 達成，CSS 以 Vite `?inline` 內嵌。
- **不新增 Tauri 權限**：HTML 為文字檔，沿用 `fs:allow-write-text-file`；列印純為 webview 的 `window.print()`，不觸及檔案系統。
- 受影響檔案：新增 `src/exporter.js`、`src/export.css`、`src/exporter.test.js`；修改 `src/files.js`、`src/main.js`、`index.html`（工具列下拉標記）、`src/style.css`（下拉樣式，若需要）。

## 對既有不變量的影響

- 不改動 scroll-sync 的 0-based source-line 不變量（匯出只讀取 `previewEl.innerHTML`，不參與捲動邏輯）。
- `files.js` 仍是**唯一**做平台分支的地方（新增的 `exportTextFile` 遵循同一模式）。
