import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createEditor } from './editor.js'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = '' // remove appended textareas + their listeners
})

function makeTextarea() {
  const ta = document.createElement('textarea')
  document.body.appendChild(ta)
  return ta
}

describe('createEditor', () => {
  it('getValue/setValue read and write the textarea', () => {
    const ta = makeTextarea()
    const ed = createEditor(ta, { onChange: () => {} })
    ed.setValue('hello')
    expect(ta.value).toBe('hello')
    expect(ed.getValue()).toBe('hello')
  })

  it('debounces input and calls onChange with the value', () => {
    const ta = makeTextarea()
    const onChange = vi.fn()
    createEditor(ta, { onChange, delay: 150 })

    ta.value = 'a'
    ta.dispatchEvent(new Event('input'))
    ta.value = 'ab'
    ta.dispatchEvent(new Event('input'))

    expect(onChange).not.toHaveBeenCalled() // still within debounce window
    vi.advanceTimersByTime(150)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('ab')
  })
})
