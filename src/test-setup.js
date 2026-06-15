// Node v25 ships a native, non-functional `localStorage` on globalThis (no real
// getItem/setItem). It shadows jsdom's, and Vitest's populateGlobal does not
// override it. Detect a broken localStorage by probing it, and only then replace
// it with a faithful in-memory Storage. This depends on no Vitest/jsdom internals,
// so it stays correct across Node and Vitest versions.

class MemoryStorage {
  #data = new Map()
  get length() { return this.#data.size }
  key(n) { return [...this.#data.keys()][n] ?? null }
  getItem(k) { return this.#data.has(String(k)) ? this.#data.get(String(k)) : null }
  setItem(k, v) { this.#data.set(String(k), String(v)) }
  removeItem(k) { this.#data.delete(String(k)) }
  clear() { this.#data.clear() }
}

function isFunctionalStorage(storage) {
  try {
    storage.setItem('__probe__', '1')
    const ok = storage.getItem('__probe__') === '1'
    storage.removeItem('__probe__')
    return ok
  } catch {
    return false
  }
}

if (!isFunctionalStorage(globalThis.localStorage)) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    writable: true,
    configurable: true,
  })
}
