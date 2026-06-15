import { defineConfig } from 'vitest/config'

// Vanilla JS: no framework plugin needed. index.html at the root is the entry.
export default defineConfig({
  clearScreen: false,            // keep cargo/Rust output visible (TOP-LEVEL, not under server)
  server: {
    port: 1420,
    strictPort: true,            // Tauri's devUrl points at 1420; fail rather than drift
    watch: { ignored: ['**/src-tauri/**'] },
  },
  test: {
    environment: 'jsdom',        // renderer/editor/storage tests touch the DOM
    setupFiles: ['./src/test-setup.js'],  // patches globalThis.localStorage on Node v25+
  },
})
