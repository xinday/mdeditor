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
