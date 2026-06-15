# Markdown Editor (Tauri v2) — 設計文件

日期:2026-06-15
狀態:已核准設計,待寫實作計畫

## 目標

打造一個可編輯的 Markdown 檢視/編輯器。同一套 web 前端:

- 可當**網頁版**直接執行(`npm run dev`)。
- 可用 **Tauri v2** 包成**桌面視窗版**。

遵循 **KISS** 原則,先做出可用的 **MVP**,並以 **git** 版控專案原始碼。

## 範圍(MVP)

做:

- 左右分割版面:左邊編輯(textarea),右邊即時預覽。
- Markdown 渲染:CommonMark + GFM(表格、刪除線、工作清單、自動連結)。
- 程式碼區塊語法高亮(highlight.js)。
- Mermaid 圖表渲染(```mermaid 圍欄區塊)。
- 檔案處理:新建 / 開啟 / 存檔 / 另存為 `.md`,含鍵盤快捷鍵。
- localStorage 自動保存上次編輯內容,重開可恢復。
- 桌面版(Tauri)與網頁版兩種執行形態。

不做(MVP 之外,日後可加):

- 文件版本歷史 / 多分頁 / 檔案樹瀏覽。
- 即時協作、雲端同步。
- 原始 HTML 穿透(預設關閉,見「安全性」)。
- 匯出 PDF / 列印樣式最佳化。
- 主題切換(MVP 提供單一乾淨樣式,深色模式日後再加)。

## 技術選型

- **建置工具**:Vite(開發伺服器 + 靜態打包)。
- **前端**:原生 JavaScript(ES modules),不使用框架——這個規模的單向資料流用原生 JS 足夠,相依最少、最 KISS。
- **桌面**:Tauri v2(系統 WebView + Rust 後端)。Tauri CLI 以 npm 開發相依 `@tauri-apps/cli` 安裝,版本可鎖定、可重現。
- **Markdown**:markdown-it + `markdown-it-task-lists`。
- **語法高亮**:highlight.js。
- **圖表**:mermaid。
- **測試**:Vitest。

環境(已確認):Rust 1.95、Cargo、WebView2 (149.x) 皆就緒。

## 架構

```
mdeditor/
├─ index.html              # 前端進入頁
├─ package.json            # scripts 與相依
├─ vite.config.js
├─ src/
│  ├─ main.js              # 進入點:接線各模組、工具列、快捷鍵、狀態
│  ├─ editor.js            # 編輯區:input 事件 → 回呼
│  ├─ renderer.js          # markdown-it + highlight.js + mermaid → HTML
│  ├─ storage.js           # localStorage 自動保存 / 恢復
│  ├─ files.js             # 檔案開/存(Tauri 原生;網頁版降級)
│  └─ style.css            # 版面與樣式
├─ src-tauri/              # Tauri (Rust) 端
│  ├─ Cargo.toml
│  ├─ tauri.conf.json
│  └─ src/main.rs
└─ docs/superpowers/specs/ # 設計文件
```

### 模組職責與介面

每個模組單一職責、以明確介面溝通,可獨立理解與測試。

| 模組 | 職責 | 對外介面(概念) | 相依 |
|------|------|------------------|------|
| `renderer.js` | 把 Markdown 文字轉成安全 HTML;辨識 mermaid 區塊;對渲染後容器執行 mermaid。 | `render(markdown) → htmlString`;`runMermaid(container)` | markdown-it、task-lists、highlight.js、mermaid |
| `editor.js` | 包裝 textarea,提供取值/設值,並在輸入時(debounce)觸發回呼。 | `createEditor(el, { onChange })`;`getValue()`;`setValue(text)` | 無 |
| `storage.js` | 將目前內容存入 localStorage,啟動時恢復。 | `loadDraft() → text`;`saveDraft(text)` | 無(瀏覽器 localStorage) |
| `files.js` | 新建/開啟/存檔/另存。Tauri 環境用原生對話框與 FS;網頁環境降級為 `<input type=file>` 上傳與 Blob 下載。 | `newFile()`;`openFile() → {path, content}`;`saveFile(path, content)`;`saveFileAs(content) → path` | `@tauri-apps/plugin-dialog`、`@tauri-apps/plugin-fs`(僅桌面) |
| `main.js` | 協調者:初始化、接線事件、管理目前檔案路徑與 dirty 狀態、工具列與快捷鍵。 | — | 上述全部 |

### 資料流

```
使用者輸入
  → editor onChange (debounce ~150ms)
    → renderer.render(text) → HTML 字串
      → 寫入預覽區 innerHTML
      → renderer.runMermaid(預覽區)  // 重新渲染 mermaid 圖
    → storage.saveDraft(text)        // 自動保存(同樣 debounce)
```

檔案操作流(以開啟為例):
```
按「開啟」/Ctrl+O
  → files.openFile() 取得 {path, content}
    → editor.setValue(content)
    → 觸發一次渲染
    → 記錄 currentPath、清除 dirty
```

## Markdown 渲染細節

- markdown-it 設定:`html: false`、`linkify: true`、`typographer: true`。
- GFM:表格與刪除線為 markdown-it 內建;工作清單用 `markdown-it-task-lists`;自動連結用 `linkify`。
- 語法高亮:設定 markdown-it 的 `highlight` 回呼,呼叫 highlight.js;載入對應 CSS 主題。
- Mermaid:覆寫 fence 規則,當語言為 `mermaid` 時輸出 `<pre class="mermaid">…原始碼…</pre>`(原始碼以文字逸出);插入 DOM 後呼叫 `mermaid.run()` 渲染。

## 安全性

- markdown-it `html: false`:來源 Markdown 內的原始 HTML(含 `<script>`)會被當文字逸出,不執行——這是 MVP 最簡單且安全的預設,**因此不需引入 DOMPurify**。
- mermaid `securityLevel: 'strict'`:由 mermaid 自身淨化圖表標籤。
- highlight.js 的輸出由我們自己產生(非來源 HTML 穿透),安全。
- 日後若要支援原始 HTML 穿透,再導入 DOMPurify 淨化。

## 錯誤處理

- **Mermaid 語法錯誤**:逐圖以 try/catch 包裹渲染,失敗時於該圖位置顯示錯誤訊息,不讓整頁崩潰。
- **檔案讀寫失敗**:以非阻斷提示(toast/狀態列訊息)告知使用者,保留目前編輯內容。
- **localStorage 不可用**(隱私模式等):自動保存靜默失敗,不影響編輯。

## 執行形態偵測

`files.js` 以 `window.__TAURI__`(或 `@tauri-apps/api` 偵測)判斷是否在 Tauri 環境:

- 桌面:用原生 dialog + fs plugin。
- 網頁:降級為 `<input type=file>` 載入、Blob + `download` 屬性存檔(無真實「覆寫存檔」,另存即下載)。

## 鍵盤快捷鍵

- `Ctrl+N` 新建、`Ctrl+O` 開啟、`Ctrl+S` 存檔、`Ctrl+Shift+S` 另存為。

## NPM Scripts

- `npm run dev` — Vite 開發伺服器(網頁版)。
- `npm run build` — Vite 靜態打包。
- `npm run tauri:dev` — Tauri 桌面開發模式。
- `npm run tauri:build` — 打包桌面安裝檔。
- `npm test` — Vitest 單元測試。

## 測試策略

以 Vitest 對純邏輯模組做單元測試:

- **renderer**:
  - 標題、段落基本渲染。
  - GFM:表格、刪除線、工作清單 checkbox、自動連結。
  - 程式碼區塊含 highlight.js 類別。
  - `mermaid` 圍欄區塊轉成 `<pre class="mermaid">`。
  - `html: false`:來源 `<script>` 被逸出為文字。
- **storage**:`saveDraft` 後 `loadDraft` 取回相同值;無資料時回傳預設空字串。

`files.js` 與 Tauri/瀏覽器 API 緊耦合,MVP 不做完整單元測試;僅對可純函式化的部分(如環境偵測、檔名處理)測試。

## 里程碑(供實作計畫參考)

1. 專案骨架:Vite + 原生 JS,index.html、基本左右分割版面。
2. renderer:markdown-it + GFM + highlight.js + mermaid,含測試。
3. editor + storage:即時預覽 + 自動保存,含 storage 測試。
4. Tauri v2 整合:src-tauri 設定、dialog/fs plugin、視窗。
5. files:開/存/另存 + 快捷鍵 + 網頁降級。
6. 收尾:樣式、錯誤處理、README。

## 開放問題

無。設計已與使用者確認。
