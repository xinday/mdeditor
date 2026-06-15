import { describe, it, expect } from 'vitest'
import { render } from './renderer.js'

describe('render', () => {
  it('renders a heading', () => {
    expect(render('# Hello')).toContain('<h1>Hello</h1>')
  })

  it('renders a GFM table', () => {
    const md = '| a | b |\n| - | - |\n| 1 | 2 |'
    expect(render(md)).toContain('<table>')
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
    expect(out).toContain('<pre class="mermaid">')
    expect(out).toContain('graph TD')
    expect(out).not.toContain('hljs')
  })

  it('escapes raw HTML in source (html:false)', () => {
    const out = render('<script>alert(1)</script>')
    expect(out).toContain('&lt;script&gt;')
    expect(out).not.toContain('<script>')
  })
})
