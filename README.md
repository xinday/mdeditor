# mdeditor

一個遵循 KISS 原則的 Markdown 編輯器，具備即時分割視窗預覽 —— 可作為網頁版 app（Vite）與桌面版 app（Tauri v2）執行。

## 線上版

🔗 **https://xinday.github.io/mdeditor/**

純前端、無後端，所有功能（編輯、預覽、開檔/存檔、匯出 HTML/PDF、草稿自動儲存）都在瀏覽器端執行。

## 功能
- 即時分割視窗編輯，支援 GitHub Flavored Markdown（表格、刪除線、任務清單、自動連結）
- 語法高亮（highlight.js）
- Mermaid 圖表，並對每張圖表做錯誤隔離
- 檔案新建/開啟/儲存/另存（`Ctrl+N` / `Ctrl+O` / `Ctrl+S` / `Ctrl+Shift+S`）
- 自動將目前草稿儲存至 localStorage（下次啟動時還原）

## 開發
- `npm run dev` —— 網頁版 app，位於 http://localhost:1420
- `npm run tauri:dev` —— 桌面視窗（需要 Rust 工具鏈）
- `npm test` —— 單元測試（Vitest）

## 建置
- `npm run build` —— 靜態網頁建置至 `dist/`（透過 HTTP 提供，例如 `npm run preview`）
- `npm run build:single` —— 單一自包含的 `dist-single/index.html`（所有 JS/CSS 內嵌；雙擊即可離線開啟）
- `npm run tauri:build` —— 桌面版安裝程式

## 部署（GitHub Pages）

專案內含 `.github/workflows/deploy-pages.yml`：推送到 `master` 會由 GitHub Actions 自動 `npm run build` 並部署 `dist/`。

一次性設定：repo **Settings → Pages → Build and deployment → Source** 選「**GitHub Actions**」。

（`vite.config.js` 在 build 時使用相對 `base`（`'./'`），因此同一份 `dist/` 可同時用於 GitHub Pages 子路徑與 Tauri 根路徑。）

## 需求
- Node.js + npm
- 桌面版 app 另需：Rust 工具鏈與（Windows）WebView2。
