# 精準捲動同步設計（改用 CodeMirror 6）

- 日期：2026-06-16
- 狀態：已核可，待寫實作計畫
- 範圍：編輯器與預覽區的左右捲動對齊

## 問題

目前 `src/scrollsync.js` 採用**比例式同步**：把捲動位置當成單一比例
（`scrollTop / (scrollHeight - clientHeight)`）從一邊套到另一邊。只有當兩邊內容
「長高的速度」一致時才會對齊；但預覽區裡的標題、程式碼區塊、圖片、表格、mermaid
圖，佔的垂直高度與對應的原始行數差異很大，因此捲過高低不均的內容後兩邊會愈飄愈遠。

## 解法概觀

改為**以原始行號為錨點 + 線性內插**的同步（與 VS Code Markdown 預覽同策略）：

1. 渲染器在每個頂層區塊標上來源行號（`data-source-line`）。
2. 預覽區因此擁有一串「行號 ↔ 像素位置（`offsetTop`）」的錨點。
3. 編輯器（CodeMirror 6）原生知道「某一行在哪個像素」與「畫面頂端是第幾行」。
4. 同步模組在兩串座標之間做線性內插，使兩邊頂端對齊的永遠是「同一原始行」，
   而非同一個百分比。

決策：採用 **CodeMirror 6** 取代純 `<textarea>`，理由是它原生提供行座標 API
（精準度更穩），並順帶取得語法高亮、行號等編輯體驗。已與使用者確認接受多一個相依
套件與打包體積增加。

## 元件改動

### `package.json`
新增相依：`codemirror`、`@codemirror/lang-markdown`（CM6，ESM、可 tree-shake，
會連帶帶入 `@codemirror/state`、`@codemirror/view`、`@codemirror/language`、
`@codemirror/commands`、`@lezer/*` 等）。

### `index.html`
`<textarea id="editor">` 改為 `<div id="editor"></div>` 作為 CodeMirror 掛載容器。

### `editor.js`（改寫，對外 API 保持相容）
維持既有公開介面，使 `main.js` 幾乎不需改動：
- `getValue()` → `view.state.doc.toString()`
- `setValue(text)` → 以一個 transaction 取代整份文件
- `onChange(text)`：透過 `EditorView.updateListener` 過濾 `update.docChanged`，
  沿用 150ms 防抖

新增幾何方法，將 CodeMirror 細節封裝起來，使同步模組與編輯器解耦：
- `topLine()` → 回傳目前頂端的「小數行號」（整數行號 + 行內比例，讓捲動平滑）
- `scrollToLine(lineFloat)` → 捲動使該小數行號貼齊視窗頂端
- `scrollEl` → 曝光 `view.scrollDOM` 供同步模組掛 `scroll` 監聽

幾何換算（CM6）：
- 文件座標頂端高度 `topHeight = scrollEl.getBoundingClientRect().top - view.documentTop`
- `block = view.lineBlockAtHeight(topHeight)`；行號 `view.state.doc.lineAt(block.from).number`
- 行內比例 `(topHeight - block.top) / block.height`
- 反向：由小數行號求 `block = view.lineBlockAt(doc.line(n).from)`，
  目標文件高度 `block.top + frac * block.height`，再加上常數 padding 還原為 `scrollTop`

啟用的編輯器功能（已與使用者確認）：Markdown 語法高亮、行號、自動換行
（維持現有換行手感）、目前行高亮；字型沿用現行 monospace 14px / line-height 1.6。

### `renderer.js`
新增一條 markdown-it core rule，對頂層 token（`token.level === 0` 且具
`token.map`）寫入 `data-source-line="<token.map[0]>"`。自訂的 fence / mermaid
渲染輸出需另外補上同屬性（因為自訂 `highlight()` 會手組 `<pre><code>`，
不會自動帶 `token.attrs`）。

### `scrollsync.js`（改寫）
- 收集預覽區 `[data-source-line]` 錨點，得到 `{ line, top: el.offsetTop }` 串列，
  依行號排序；每次處理 scroll 事件時即時查詢，避免內容變動造成過時。
- 編輯器 → 預覽：取 `editor.topLine()` 得 L，找夾住 L 的上下兩錨點，
  以 `frac = (L - a.line)/(b.line - a.line)` 內插出
  `preview.scrollTop = a.top + frac*(b.top - a.top)`。
- 預覽 → 編輯器：依 `preview.scrollTop = S` 找夾住 S 的上下兩錨點（以 `top` 比較），
  以 `frac = (S - a.top)/(b.top - a.top)` 內插出 `L = a.line + frac*(b.line - a.line)`，
  呼叫 `editor.scrollToLine(L)`。
- **保留現有的 requestAnimationFrame 重入鎖**（避免兩邊互相回彈，已有測試，照搬語意）。
- 端點與無錨點時做 clamp 或安全退回（不丟例外）。

對外簽章調整：`syncScroll(editor, previewEl)`，其中 `editor` 為 editor 物件
（提供 `topLine` / `scrollToLine` / `scrollEl`）。

### `main.js`
- `syncScroll(editorEl, previewEl)` 改為傳入 editor 物件與 preview 元素。
- 每次 `renderPreview` 完成後，做一次「編輯器 → 預覽」重新對齊，讓編輯時預覽跟著走。

### `style.css`
`#editor` 改為容器樣式（`min-height:0; overflow:hidden`，由 CM 的 `.cm-scroller`
負責捲動）；將原本的 padding / 字型 / 換行套到 `.cm-scroller` / `.cm-content`，
維持外觀一致。

## 資料流

```
使用者捲動編輯器
  → editor.scrollEl 的 scroll 事件
  → 取得 editor.topLine()（小數行號 L）
  → 在 preview 錨點中內插出像素位置
  → 設定 preview.scrollTop（rAF 鎖內，避免回彈）

使用者捲動預覽
  → preview 的 scroll 事件
  → 依 preview.scrollTop 在錨點中內插出小數行號 L
  → editor.scrollToLine(L)（rAF 鎖內）

使用者編輯
  → onChange（防抖）→ 重新渲染預覽（含 data-source-line）
  → 重跑一次「編輯器 → 預覽」對齊
```

## 測試策略（TDD）

- `scrollsync.test.js`（改寫）：以假的 editor（`topLine` / `scrollToLine` 為 spy）
  與帶 `data-source-line`、stub `offsetTop` 的假預覽，驗證：
  - 編輯器→預覽：兩錨點之間的內插落點正確
  - 預覽→編輯器：兩錨點之間內插出的小數行號正確
  - 重入鎖仍能擋住回彈，且下一個 animation frame 後解除
  - 端點 clamp 與無錨點退回
- `renderer.test.js`（更新）：既有斷言（如 `<h1>Hello</h1>`）會因新增屬性而失敗，
  放寬為屬性容忍式（例如同時檢查 `<h1` 與 `Hello</h1>`，或直接檢查
  `data-source-line`）；新增驗證頂層區塊有 `data-source-line` 的測試。
- `editor.test.js`（改寫）：以 CM6 驗 `getValue` / `setValue` / `onChange` 防抖。
  **限制**：CM6 幾何（行像素）在 jsdom 無版面、量不到，故 `topLine` / `scrollToLine`
  不做單元測試，改由同步模組的內插測試與手動實機驗證覆蓋。

## 取捨與風險

- 多一個相依套件、打包體積增加（CM6 tree-shake 後約數十～上百 KB）。
- 改動範圍中等（`editor.js` 全改、三個測試檔調整），但對外介面穩定，風險可控。
- 換行模式下行高不均，靠 CM 原生行座標 API 處理，精準度不受影響。
- `data-source-line` 改變了渲染輸出，需同步更新既有渲染器測試。

## 非目標（YAGNI）

- 不做「捲到游標所在行置中」之類的額外功能。
- 不替換 markdown-it / mermaid / highlight.js。
- 不引入主題切換、設定面板等與本次目標無關的功能。
```
