# CLAUDE.md

本檔案為 Claude Code（claude.ai/code）在此儲存庫中工作時提供指引。

## 語言規則

- **優先使用繁體中文**：所有對話、說明、commit message、PR 內容與註解都以繁體中文撰寫；程式碼識別字、指令與專有名詞維持原文。

## 這是什麼

一個遵循 KISS 原則的 Markdown 編輯器，具備即時分割視窗預覽，以**單一 vanilla-JS 前端**（不使用框架）建構，並出貨到**兩個目標**：網頁版（Vite）與桌面版（Tauri v2）。`src/` 是純 ES 模組；`src-tauri/` 是 Rust 外殼。

## 指令

```bash
npm run dev            # 網頁版 app，位於 http://localhost:1420（strictPort —— Tauri 的 devUrl 指向這裡）
npm test               # 所有單元測試（Vitest、jsdom），單次執行
npm run test:watch     # Vitest watch 模式
npx vitest run src/scrollsync.test.js          # 單一測試「檔案」
npx vitest run -t "suppresses the echo"        # 依名稱（子字串）執行單一測試

npm run build          # 多檔靜態建置 -> dist/（Tauri 打包的內容；需透過 HTTP 提供）
npm run build:single   # 單一自包含的 dist-single/index.html（JS/CSS 內嵌；雙擊即可離線開啟）
npm run preview        # 提供 dist/ 建置結果

npm run tauri:dev      # 桌面視窗（會先跑 `npm run dev`；需要 Rust 工具鏈）
npm run tauri:build    # 桌面版安裝程式
```

桌面版建置需要 Rust 工具鏈 +（Windows）WebView2。在 Windows 上，Tauri 需要 **MSVC** Rust target（`rustup default stable-x86_64-pc-windows-msvc`）—— GNU target 會以 `dlltool.exe not found` 失敗。

## 架構

**協調邏輯位於 `src/main.js`。** 它將各模組串接起來，並掌管核心資料流：

```
edit → editor onChange (debounced 150ms) → renderPreview(text):
         renderer.render() → previewEl.innerHTML → renderMermaid() → sync.resync()
       → storage.saveDraft()
```

其餘部分都是由 `main.js` 使用、各司其職的單一用途模組。重點在於維持這些模組邊界：

- **`editor.js`** —— 封裝一個 CodeMirror 6 `EditorView`。公開契約：`getValue` / `setValue` / debounced `onChange`，外加 `scrollEl`、`topLine()`、`scrollToLine()`、`view`。`setValue` 由 `programmatic` 旗標保護，因此**不會**觸發 `onChange`（開機/開檔/新建不應將文件標記為已修改）。編輯器的視覺樣式放在此處的 CodeMirror theme，而非 `style.css`。
- **`renderer.js`** —— markdown-it（GFM 表格/刪除線 + 任務清單 + highlight.js）。`html: false`，因此原始碼中的原生 HTML 會被跳脫（不需要 DOMPurify）。一條自訂的 `fence` 規則將 ```` ```mermaid ```` 轉成 `<pre class="mermaid">`，其餘全部交給 `highlight()`（它會手工組出完整的 `<pre><code class="hljs ...">`）。一條 core 規則為頂層區塊標上 `data-source-line`（見捲動同步）。
- **`mermaid.js`** —— `mermaid.initialize` 在模組載入時執行一次（`startOnLoad:false`、`securityLevel:'strict'`）。`renderMermaid()` 以各自的 try/catch 渲染每個 `pre.mermaid`，將壞掉的圖表替換成錯誤框，因此單一失敗不會拖垮其他圖表。仰賴 `main.js` 每次更新都重新產生 `innerHTML`（全新節點、沒有殘留狀態）。
- **`scrollsync.js`** —— `syncScroll(editor, preview)` 以**原始碼行號而非比例**讓兩個視窗對齊。它在預覽的 `[data-source-line]` 錨點與編輯器的 `topLine()` 之間雙向內插，並以 `requestAnimationFrame` 重入鎖避免兩個視窗互相回彈。回傳 `{ resync }` 供渲染後重新對齊。
- **`files.js`** / **`storage.js`** —— `files.js` 是**唯一**會依平台分支的地方：`isTauri()` 在 Tauri 的 `@tauri-apps/plugin-dialog`/`plugin-fs`（動態 import，讓 web bundle 保持乾淨）與 web 後備方案（`<input type=file>`、blob 下載）之間擇一。`storage.js` 是 localStorage 草稿自動儲存，在儲存空間不可用時靜默降級。

**捲動同步不變量（牽涉 3 個檔案）：** 原始碼行號從頭到尾都是 **0-based** —— renderer 發出 `data-source-line="<token.map[0]>"`（0-based），`editor.js` 的幾何計算回傳/接受 0-based 行號（`doc.lineAt(...).number - 1`），而 `scrollsync.js` 原封不動傳遞。若你動到這三者之一，請保持一致。錨點僅存在於頂層區塊；區塊內部的對齊是內插出來的（一個小而可接受的殘差）。

**設計/計畫文件：** 非瑣碎的功能會在實作前先於 `docs/superpowers/specs/` 與 `docs/superpowers/plans/` 寫下規格 —— 捲動同步設計背後的理由請查閱該處。

## 測試須知

- Vitest 在 **jsdom** 中執行。`vite.config.js` 載入 `src/test-setup.js`，它會在 Node v25+ 上以記憶體內的 `Storage` 取代壞掉的原生 `localStorage`（請勿移除 —— `storage.test.js` 等測試仰賴它）。
- CodeMirror 的**幾何**（`topLine`/`scrollToLine`）刻意**不做**單元測試：jsdom 沒有版面配置，因此高度都是 0。`scrollsync.test.js` 改以一個假的 editor + stub 過的 `offsetTop` 來驗證內插/回彈防護邏輯。請在瀏覽器中（`npm run dev`）驗證實際的捲動對齊。

## Tauri 細節

- Rust 套件名為 `app`，因此其 lib crate 為 `app_lib`；`src-tauri/src/main.rs` 呼叫 `app_lib::run()`（位於 `lib.rs`），它會註冊 `dialog` 與 `fs` 外掛。Capabilities 位於 `src-tauri/capabilities/`。
- `tauri.conf.json` 設定 `beforeDevCommand: npm run dev`、`devUrl: http://localhost:1420`、`frontendDist: ../dist` —— 因此 `tauri:build` 依賴 `npm run build` 的輸出。
- `scripts/make-icon.cjs` 僅用 Node 內建功能（離線）寫出 `src-tauri/app-icon.png`，作為 `tauri icon` 的種子圖。
