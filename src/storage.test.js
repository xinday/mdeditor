import { describe, it, expect, beforeEach } from 'vitest'
import { loadDraft, saveDraft } from './storage.js'

describe('draft storage', () => {
  beforeEach(() => localStorage.clear())

  it('returns empty string when nothing is saved', () => {
    expect(loadDraft()).toBe('')
  })

  it('round-trips saved content', () => {
    saveDraft('# hi')
    expect(loadDraft()).toBe('# hi')
  })

  it('overwrites previous content', () => {
    saveDraft('first')
    saveDraft('second')
    expect(loadDraft()).toBe('second')
  })
})
