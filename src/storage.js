const KEY = 'mdeditor:draft'

export function loadDraft() {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch (_) {
    return '' // localStorage unavailable (e.g. privacy mode) — degrade silently
  }
}

export function saveDraft(text) {
  try {
    localStorage.setItem(KEY, text)
  } catch (_) {
    /* ignore write failures */
  }
}
