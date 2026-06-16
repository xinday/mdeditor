import { describe, it, expect, afterEach, vi } from 'vitest'
import { syncScroll } from './scrollsync.js'

afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

// Build a fake preview (with stubbed scrollTop) holding anchor elements whose
// data-source-line + offsetTop we control, plus a fake editor exposing the
// scrollsync contract (scrollEl + topLine/scrollToLine spies).
function setup(anchors) {
  const preview = document.createElement('div')
  let top = 0
  Object.defineProperty(preview, 'scrollTop', { get: () => top, set: (v) => { top = v }, configurable: true })
  for (const a of anchors) {
    const el = document.createElement('div')
    el.setAttribute('data-source-line', String(a.line))
    Object.defineProperty(el, 'offsetTop', { get: () => a.top, configurable: true })
    preview.appendChild(el)
  }
  document.body.appendChild(preview)

  const scrollEl = document.createElement('div')
  document.body.appendChild(scrollEl)
  const editor = { scrollEl, topLine: vi.fn(), scrollToLine: vi.fn() }

  const sync = syncScroll(editor, preview)
  return { editor, preview, sync }
}

const ANCHORS = [
  { line: 0, top: 0 },
  { line: 10, top: 100 },
  { line: 20, top: 400 },
]

describe('syncScroll', () => {
  it('editor scroll sets preview to the interpolated pixel for the top line', () => {
    const { editor, preview } = setup(ANCHORS)
    editor.topLine.mockReturnValue(5) // halfway between line 0 (top 0) and line 10 (top 100)
    editor.scrollEl.dispatchEvent(new Event('scroll'))
    expect(preview.scrollTop).toBe(50)
  })

  it('preview scroll calls editor.scrollToLine with the interpolated line', () => {
    const { editor, preview } = setup(ANCHORS)
    preview.scrollTop = 250 // halfway between top 100 (line 10) and top 400 (line 20)
    preview.dispatchEvent(new Event('scroll'))
    expect(editor.scrollToLine).toHaveBeenCalledWith(15)
  })

  it('clamps to the last anchor when the top line is past the end', () => {
    const { editor, preview } = setup(ANCHORS)
    editor.topLine.mockReturnValue(99)
    editor.scrollEl.dispatchEvent(new Event('scroll'))
    expect(preview.scrollTop).toBe(400)
  })

  it('editor scroll interpolates within the second anchor span', () => {
    const { editor, preview } = setup(ANCHORS)
    editor.topLine.mockReturnValue(15) // halfway between line 10 (top 100) and line 20 (top 400)
    editor.scrollEl.dispatchEvent(new Event('scroll'))
    expect(preview.scrollTop).toBe(250)
  })

  it('clamps to the first anchor when the top line is before it', () => {
    const { editor, preview } = setup(ANCHORS)
    editor.topLine.mockReturnValue(-2) // before the first anchor (line 0)
    editor.scrollEl.dispatchEvent(new Event('scroll'))
    expect(preview.scrollTop).toBe(0)
  })

  it('suppresses the echo while locked, then resumes after the frame', () => {
    const frames = []
    vi.stubGlobal('requestAnimationFrame', (cb) => { frames.push(cb); return frames.length })

    const { editor, preview } = setup(ANCHORS)
    editor.topLine.mockReturnValue(5)
    editor.scrollEl.dispatchEvent(new Event('scroll')) // locks "editor", sets preview to 50
    expect(preview.scrollTop).toBe(50)

    // While "editor" holds the lock, a preview scroll must NOT drive the editor.
    preview.scrollTop = 80
    preview.dispatchEvent(new Event('scroll'))
    expect(editor.scrollToLine).not.toHaveBeenCalled()

    frames.forEach((cb) => cb()) // release the lock

    preview.scrollTop = 80
    preview.dispatchEvent(new Event('scroll'))
    expect(editor.scrollToLine).toHaveBeenCalledTimes(1) // release works
  })

  it('does nothing when there are no anchors', () => {
    const { editor, preview } = setup([])
    editor.topLine.mockReturnValue(5)
    expect(() => editor.scrollEl.dispatchEvent(new Event('scroll'))).not.toThrow()
    preview.dispatchEvent(new Event('scroll'))
    expect(editor.scrollToLine).not.toHaveBeenCalled()
  })

  it('resync() re-aligns the preview to the editor on demand', () => {
    const { editor, preview, sync } = setup(ANCHORS)
    editor.topLine.mockReturnValue(10)
    sync.resync()
    expect(preview.scrollTop).toBe(100)
  })
})
