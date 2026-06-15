import mermaid from 'mermaid'

// Initialize ONCE at module load (never per render).
mermaid.initialize({
  startOnLoad: false,      // we drive rendering ourselves
  securityLevel: 'strict', // sanitize untrusted user-typed diagrams
  theme: 'default',
})

let counter = 0

/**
 * Render every <pre class="mermaid"> inside `container`.
 * Each diagram renders in its own try/catch via mermaid.render, so one bad
 * diagram never throws or breaks the others — it is replaced by an error box.
 * Because the caller regenerates container.innerHTML each update, nodes are
 * always fresh (no stale data-processed bookkeeping needed).
 */
export async function renderMermaid(container) {
  const nodes = container.querySelectorAll('pre.mermaid')
  await Promise.all(
    Array.from(nodes).map(async (node) => {
      const code = node.textContent.trim() // browser-decoded raw diagram source
      if (!code) return
      const id = `mmd-${counter++}`
      try {
        const parsed = await mermaid.parse(code, { suppressErrors: true })
        if (parsed === false) throw new Error('Invalid Mermaid syntax')
        const { svg, bindFunctions } = await mermaid.render(id, code)
        const wrapper = document.createElement('div')
        wrapper.className = 'mermaid-rendered'
        wrapper.innerHTML = svg
        node.replaceWith(wrapper)
        bindFunctions?.(wrapper)
      } catch (err) {
        document.getElementById(id)?.remove()
        document.getElementById('d' + id)?.remove()
        const box = document.createElement('div')
        box.className = 'mermaid-error'
        box.setAttribute('role', 'alert')
        const title = document.createElement('strong')
        title.textContent = '圖表錯誤'
        const detail = document.createElement('pre')
        detail.textContent = (err?.message ?? String(err)) + '\n\n' + code
        box.append(title, detail)
        node.replaceWith(box)
      }
    })
  )
}
