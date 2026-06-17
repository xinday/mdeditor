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
