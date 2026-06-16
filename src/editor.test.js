import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createEditor } from './editor.js'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = '' // remove mounted editors + their listeners
})

function makeContainer() {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

describe('createEditor', () => {
  it('getValue/setValue read and write the document', () => {
    const ed = createEditor(makeContainer(), { onChange: () => {} })
    ed.setValue('hello')
    expect(ed.getValue()).toBe('hello')
  })

  it('debounces user edits and calls onChange with the value', () => {
    const onChange = vi.fn()
    const ed = createEditor(makeContainer(), { onChange, delay: 150 })

    ed.view.dispatch({ changes: { from: 0, insert: 'a' } })
    ed.view.dispatch({ changes: { from: 1, insert: 'b' } })

    expect(onChange).not.toHaveBeenCalled() // still within debounce window
    vi.advanceTimersByTime(150)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('ab')
  })

  it('setValue does not trigger onChange', () => {
    const onChange = vi.fn()
    const ed = createEditor(makeContainer(), { onChange, delay: 150 })

    ed.setValue('programmatic')
    vi.advanceTimersByTime(300)

    expect(onChange).not.toHaveBeenCalled()
  })

  it('exposes the scroll element and geometry helpers', () => {
    const ed = createEditor(makeContainer(), { onChange: () => {} })
    expect(ed.scrollEl).toBeInstanceOf(HTMLElement)
    expect(typeof ed.topLine).toBe('function')
    expect(typeof ed.scrollToLine).toBe('function')
  })
})
