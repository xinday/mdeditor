import { defineConfig } from 'vitest/config'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Vanilla JS: no framework plugin needed. index.html at the root is the entry.
// `--mode singlefile` produces one self-contained dist-single/index.html
// (all JS/CSS inlined) that runs by double-click via file://. The normal
// build stays multi-file in dist/ (what Tauri bundles and what web hosts serve).
export default defineConfig(({ command, mode }) => {
  const singlefile = mode === 'singlefile'
  return {
    // Relative base on BUILD so one dist/ works both at a URL subpath (GitHub
    // Pages project site: https://<user>.github.io/<repo>/) and at root (Tauri's
    // custom-protocol root). Dev stays '/' so Tauri's devUrl :1420 is unaffected.
    base: command === 'build' ? './' : '/',
    clearScreen: false,            // keep cargo/Rust output visible (TOP-LEVEL, not under server)
    plugins: singlefile ? [viteSingleFile()] : [],
    server: {
      port: 1420,
      strictPort: true,            // Tauri's devUrl points at 1420; fail rather than drift
      watch: { ignored: ['**/src-tauri/**'] },
    },
    build: singlefile ? { outDir: 'dist-single' } : {},
    test: {
      environment: 'jsdom',        // renderer/editor/storage tests touch the DOM
      setupFiles: ['./src/test-setup.js'],  // patches globalThis.localStorage on Node v25+
    },
  }
})
