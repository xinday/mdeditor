// 建置期 asset：把文件樣式與 highlight.js 主題讀成字串，供 buildStandaloneHtml
// 內嵌進匯出檔。Vite 的 ?inline 回傳 CSS 字串而非注入 <style>。
// 此檔不被任何測試 import，故 vitest 不會處理這兩個 ?inline 匯入。
import docCss from './export.css?inline'
import hljsCss from 'highlight.js/styles/github.css?inline'

export const EXPORT_STYLES = `${hljsCss}\n${docCss}`
