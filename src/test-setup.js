// Node v25 exposes a native `localStorage` on globalThis without --localstorage-file,
// but it is non-functional (no getItem/setItem/clear). Vitest's populateGlobal skips
// overriding it with jsdom's because `localStorage` is not in its KEYS allowlist.
// Fix: explicitly point globalThis.localStorage/sessionStorage at jsdom's versions.
if (typeof globalThis.jsdom !== 'undefined') {
  const jsdomWindow = globalThis.jsdom.window
  Object.defineProperty(globalThis, 'localStorage', {
    value: jsdomWindow.localStorage,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: jsdomWindow.sessionStorage,
    writable: true,
    configurable: true,
  })
}
