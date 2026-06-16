import { describe, it, expect } from 'vitest'
import { render } from './renderer.js'

describe('render', () => {
  it('renders a heading', () => {
    expect(render('# Hello')).toContain('>Hello</h1>')
  })

  it('renders a GFM table', () => {
    const md = '| a | b |\n| - | - |\n| 1 | 2 |'
    expect(render(md)).toContain('<table')
  })

  it('renders strikethrough', () => {
    expect(render('~~gone~~')).toContain('<s>gone</s>')
  })

  it('renders task list checkboxes', () => {
    const out = render('- [ ] todo\n- [x] done')
    expect(out).toContain('type="checkbox"')
  })

  it('autolinks bare URLs (linkify)', () => {
    expect(render('see https://example.com')).toContain('<a href="https://example.com"')
  })

  it('highlights fenced code with hljs classes', () => {
    const out = render('```js\nconst x = 1;\n```')
    expect(out).toContain('hljs')
    expect(out).toContain('language-js')
  })

  it('turns a mermaid fence into <pre class="mermaid"> (not hljs)', () => {
    const out = render('```mermaid\ngraph TD;A-->B;\n```')
    expect(out).toContain('<pre class="mermaid"')
    expect(out).toContain('graph TD')
    expect(out).not.toContain('hljs')
  })

  it('escapes code in unknown-language fences (no raw HTML)', () => {
    const out = render('```unknownlang\n<b>raw</b>\n```')
    expect(out).toContain('hljs')
    expect(out).not.toContain('<b>raw</b>')
    expect(out).toContain('&lt;b&gt;')
  })

  it('escapes raw HTML in source (html:false)', () => {
    const out = render('<script>alert(1)</script>')
    expect(out).toContain('&lt;script&gt;')
    expect(out).not.toContain('<script>')
  })

  it('stamps top-level blocks with 0-based data-source-line', () => {
    const out = render('# A\n\npara\n')
    expect(out).toContain('<h1 data-source-line="0"')
    expect(out).toMatch(/<p data-source-line="2"/) // line 0 heading, line 1 blank, line 2 paragraph
  })

  it('stamps fenced code blocks with data-source-line on the <pre>', () => {
    const out = render('text\n\n```js\nconst x = 1;\n```\n')
    expect(out).toMatch(/<pre data-source-line="2"><code/) // fence opens at line index 2
  })

  it('stamps mermaid blocks with data-source-line', () => {
    const out = render('```mermaid\ngraph TD;A-->B;\n```')
    expect(out).toContain('<pre class="mermaid" data-source-line="0"')
  })
})
