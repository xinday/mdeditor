export function isTauri() {
  return typeof window !== 'undefined' &&
    !!(window.__TAURI_INTERNALS__ || window.__TAURI__)
}

export function basename(p) {
  if (!p) return 'untitled.md'
  const parts = p.split(/[\\/]/)
  return parts[parts.length - 1] || 'untitled.md'
}

const MD_FILTER = [{ name: 'Markdown', extensions: ['md', 'markdown'] }]

// Returns { path, content } or null if cancelled.
export async function openFile() {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const { readTextFile } = await import('@tauri-apps/plugin-fs')
    const path = await open({ multiple: false, directory: false, filters: MD_FILTER })
    if (path === null) return null
    const content = await readTextFile(path)
    return { path, content }
  }
  // Web fallback: <input type=file>. The 'cancel' event settles the Promise
  // when the user dismisses the picker (otherwise 'change' never fires).
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.md,.markdown,text/markdown'
    input.onchange = async () => {
      const file = input.files?.[0]
      resolve(file ? { path: file.name, content: await file.text() } : null)
    }
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}

// Save to a known path (no dialog). If path is falsy, behaves like saveFileAs.
// Returns the path saved to, or null if cancelled.
export async function saveFile(path, content) {
  if (!path) return saveFileAs(content)
  if (isTauri()) {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    await writeTextFile(path, content)
    return path
  }
  // Web has no silent overwrite — fall back to a download.
  return webDownload(content, basename(path))
}

// Prompt for a destination. Returns the chosen path, or null if cancelled.
export async function saveFileAs(content, suggestedName = 'untitled.md') {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    const path = await save({ defaultPath: suggestedName, filters: MD_FILTER })
    if (path === null) return null
    await writeTextFile(path, content)
    return path
  }
  return webDownload(content, suggestedName)
}

function webDownload(content, name) {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
  return name
}
