import { describe, it, expect, afterEach } from 'vitest'
import { isTauri, basename } from './files.js'

afterEach(() => { delete window.__TAURI_INTERNALS__; delete window.__TAURI__ })

describe('isTauri', () => {
  it('is false in a plain web context', () => {
    expect(isTauri()).toBe(false)
  })
  it('is true when Tauri internals are present', () => {
    window.__TAURI_INTERNALS__ = {}
    expect(isTauri()).toBe(true)
  })
  it('is true when legacy __TAURI__ is present', () => {
    window.__TAURI__ = {}
    expect(isTauri()).toBe(true)
  })
})

describe('basename', () => {
  it('extracts the file name from a windows path', () => {
    expect(basename('C:\\docs\\note.md')).toBe('note.md')
  })
  it('extracts the file name from a posix path', () => {
    expect(basename('/home/u/note.md')).toBe('note.md')
  })
  it('returns the input when there is no separator', () => {
    expect(basename('note.md')).toBe('note.md')
  })
  it('falls back to a default for null', () => {
    expect(basename(null)).toBe('untitled.md')
  })
})
