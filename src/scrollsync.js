// Source-line anchored scroll sync between a CodeMirror editor and the rendered
// preview. Each preview block carries a 0-based data-source-line; the editor
// reports topLine()/scrollToLine() in 0-based source lines. Scrolling one pane
// interpolates the matching position in the other so the same source line stays
// aligned at the top edge. A re-entrancy guard (released next animation frame)
// suppresses the programmatic scroll's echo so the panes do not fight.
export function syncScroll(editor, preview) {
  let locked = null

  // Live snapshot of preview anchors as {line, top}, sorted by line. Re-read on
  // every scroll so it stays correct across re-renders. Assumes offsetTop
  // increases monotonically with source line (standard for block-level markdown
  // output); non-monotonic layouts degrade to approximate positioning.
  function anchors() {
    const list = []
    for (const el of preview.querySelectorAll('[data-source-line]')) {
      const raw = el.getAttribute('data-source-line')
      const line = raw !== null && raw !== '' ? Number(raw) : NaN
      if (Number.isFinite(line)) list.push({ line, top: el.offsetTop })
    }
    return list.sort((a, b) => a.line - b.line)
  }

  // Linear interpolation over sorted points: map field `kx` -> field `ky`,
  // clamping at both ends.
  function interp(points, x, kx, ky) {
    if (points.length === 0) return 0
    if (x <= points[0][kx]) return points[0][ky]
    const last = points[points.length - 1]
    if (x >= last[kx]) return last[ky]
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1]
      if (x >= a[kx] && x <= b[kx]) {
        const span = b[kx] - a[kx]
        const frac = span > 0 ? (x - a[kx]) / span : 0
        return a[ky] + frac * (b[ky] - a[ky])
      }
    }
    return last[ky]
  }

  function editorToPreview() {
    const points = anchors()
    if (points.length === 0) return
    preview.scrollTop = interp(points, editor.topLine(), 'line', 'top')
  }

  function previewToEditor() {
    const points = anchors()
    if (points.length === 0) return
    editor.scrollToLine(interp(points, preview.scrollTop, 'top', 'line'))
  }

  function guard(src, run) {
    return () => {
      if (locked && locked !== src) return
      locked = src
      run()
      requestAnimationFrame(() => { locked = null })
    }
  }

  editor.scrollEl.addEventListener('scroll', guard('editor', editorToPreview))
  preview.addEventListener('scroll', guard('preview', previewToEditor))

  // Re-align the preview to the editor (e.g. after the preview re-renders).
  // Guarded so the resulting preview scroll does not echo back into the editor.
  return { resync: guard('editor', editorToPreview) }
}
