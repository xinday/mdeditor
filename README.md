# mdeditor

A KISS markdown editor with live split-pane preview — runs as a web app (Vite) and a desktop app (Tauri v2).

## Features
- Live split-pane editing with GitHub Flavored Markdown (tables, strikethrough, task lists, autolinks)
- Syntax highlighting (highlight.js)
- Mermaid diagrams with per-diagram error isolation
- File new/open/save/save-as (`Ctrl+N` / `Ctrl+O` / `Ctrl+S` / `Ctrl+Shift+S`)
- Autosave of the current draft to localStorage (restored on next launch)

## Develop
- `npm run dev` — web app at http://localhost:1420
- `npm run tauri:dev` — desktop window (requires Rust toolchain)
- `npm test` — unit tests (Vitest)

## Build
- `npm run build` — static web build to `dist/` (serve over HTTP, e.g. `npm run preview`)
- `npm run build:single` — one self-contained `dist-single/index.html` (all JS/CSS inlined; opens offline by double-click)
- `npm run tauri:build` — desktop installers

## Requirements
- Node.js + npm
- For the desktop app: Rust toolchain and (Windows) WebView2.
