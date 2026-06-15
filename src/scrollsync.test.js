import { describe, it, expect, afterEach, vi } from 'vitest'
import { syncScroll } from './scrollsync.js'

afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

function fakeEl(scrollHeight, clientHeight) {
  const el = document.createElement('div')
  let top = 0
  Object.defineProperty(el, 'scrollTop', { get: () => top, set: (v) => { top = v }, configurable: true })
  Object.defineProperty(el, 'scrollHeight', { get: () => scrollHeight, configurable: true })
  Object.defineProperty(el, 'clientHeight', { get: () => clientHeight, configurable: true })
  document.body.appendChild(el)
  return el
}

describe('syncScroll', () => {
  it('scrolls the other element to the same fractional position', () => {
    const a = fakeEl(200, 100) // scrollable range 100
    const b = fakeEl(400, 100) // scrollable range 300
    syncScroll(a, b)
    a.scrollTop = 50           // 50% of a's range
    a.dispatchEvent(new Event('scroll'))
    expect(b.scrollTop).toBe(150) // 50% of b's range (0.5 * 300)
  })

  it('is bidirectional', () => {
    const a = fakeEl(400, 100) // range 300
    const b = fakeEl(200, 100) // range 100
    syncScroll(a, b)
    b.scrollTop = 25           // 25% of b's range
    b.dispatchEvent(new Event('scroll'))
    expect(a.scrollTop).toBe(75) // 0.25 * 300
  })

  it('suppresses the echo while locked, then resumes after the frame', () => {
    const frames = []
    vi.stubGlobal('requestAnimationFrame', (cb) => { frames.push(cb); return frames.length })

    const a = fakeEl(200, 100) // scrollable range 100
    const b = fakeEl(400, 100) // scrollable range 300
    syncScroll(a, b)

    a.scrollTop = 50
    a.dispatchEvent(new Event('scroll')) // locks "a", sets b to 150
    expect(b.scrollTop).toBe(150)

    // While "a" holds the lock, a real move of b must NOT echo back to a.
    b.scrollTop = 300                    // b jumps to the bottom
    b.dispatchEvent(new Event('scroll'))
    expect(a.scrollTop).toBe(50)         // guard active: a unchanged (would be 100 without the guard)

    // Release the lock by running the rAF callback captured from a's handler.
    frames.forEach((cb) => cb())

    // Now b can drive a again.
    b.scrollTop = 300
    b.dispatchEvent(new Event('scroll'))
    expect(a.scrollTop).toBe(100)        // release works: ratio 1.0 * range 100
  })

  it('treats a non-scrollable source as position 0', () => {
    const a = fakeEl(100, 100) // range 0
    const b = fakeEl(400, 100)
    syncScroll(a, b)
    a.scrollTop = 0
    a.dispatchEvent(new Event('scroll'))
    expect(b.scrollTop).toBe(0)
  })
})
