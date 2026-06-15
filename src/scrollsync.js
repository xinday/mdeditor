// Proportionally link two scrollable elements: scrolling one scrolls the other
// to the same fractional position. A re-entrancy guard (released on the next
// animation frame) ignores the programmatic scroll's echo so the panes do not fight.
export function syncScroll(a, b) {
  let locked = null
  const handler = (src, dst) => () => {
    if (locked && locked !== src) return
    locked = src
    const range = src.scrollHeight - src.clientHeight
    const ratio = range > 0 ? src.scrollTop / range : 0
    dst.scrollTop = ratio * (dst.scrollHeight - dst.clientHeight)
    requestAnimationFrame(() => { locked = null })
  }
  a.addEventListener('scroll', handler(a, b))
  b.addEventListener('scroll', handler(b, a))
}
