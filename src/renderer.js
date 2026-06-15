import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import hljs from 'highlight.js/lib/common'
import 'highlight.js/styles/github.css'

// highlight callback: (str, lang) => string of HTML.
// Returns a FULL <pre><code class="hljs ..."> wrapper so markdown-it does NOT
// re-wrap it and the theme's .hljs styles apply. Never throws.
function highlight(str, lang) {
  if (lang && hljs.getLanguage(lang)) {
    try {
      const inner = hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
      return `<pre><code class="hljs language-${lang}">${inner}</code></pre>`
    } catch (_) { /* fall through */ }
  }
  return `<pre><code class="hljs">${md.utils.escapeHtml(str)}</code></pre>`
}

const md = new MarkdownIt({
  html: false,        // raw HTML in source is escaped — safe default, no DOMPurify needed
  linkify: true,      // defaults to false; autolink bare URLs
  typographer: true,
  highlight,
})

// Tables + strikethrough are built-in and ON by default (GFM). Add task lists.
md.use(taskLists, { enabled: true, label: true })

// Override the fence renderer so ```mermaid blocks become <pre class="mermaid">
// with escaped raw code; every other language falls through to the default
// renderer (which invokes `highlight`).
const defaultFence =
  md.renderer.rules.fence ||
  function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options)
  }

md.renderer.rules.fence = function (tokens, idx, options, env, self) {
  const token = tokens[idx]
  const lang = (token.info ? token.info.trim() : '').split(/\s+/g)[0]
  if (lang === 'mermaid') {
    return `<pre class="mermaid">${md.utils.escapeHtml(token.content)}</pre>\n`
  }
  return defaultFence(tokens, idx, options, env, self)
}

export function render(markdown) {
  return md.render(markdown)
}
