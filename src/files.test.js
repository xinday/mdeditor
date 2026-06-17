import { describe, it, expect, afterEach, vi } from 'vitest'
import { isTauri, basename, exportTextFile } from './files.js'

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

describe('exportTextFile (web)', () => {
  let origCreate, origRevoke, clickSpy
  afterEach(() => {
    URL.createObjectURL = origCreate
    URL.revokeObjectURL = origRevoke
    clickSpy?.mockRestore()
  })

  it('downloads a blob with the given mime and name, and returns the name', async () => {
    origCreate = URL.createObjectURL
    origRevoke = URL.revokeObjectURL
    let captured = null
    URL.createObjectURL = vi.fn((blob) => { captured = blob; return 'blob:fake' })
    URL.revokeObjectURL = vi.fn()
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const name = await exportTextFile('<h1>hi</h1>', 'doc.html', {
      name: 'HTML', extensions: ['html'], mime: 'text/html',
    })

    expect(name).toBe('doc.html')
    expect(captured).toBeInstanceOf(Blob)
    expect(captured.type).toBe('text/html')
    expect(await captured.text()).toBe('<h1>hi</h1>')
  })
})
