import { describe, it, expect } from 'vitest'
import { buildStandaloneHtml } from './exporter.js'

describe('buildStandaloneHtml', () => {
  it('wraps the body in a standalone HTML document', () => {
    const html = buildStandaloneHtml({ title: 'Note', bodyHtml: '<h1>Hi</h1>', styles: '' })
    expect(html).toMatch(/^<!doctype html>/i)
    expect(html).toContain('<title>Note</title>')
    expect(html).toContain('<article class="markdown-body">')
    expect(html).toContain('<h1>Hi</h1>')
  })

  it('inlines the provided styles in a <style> block', () => {
    const html = buildStandaloneHtml({ title: 't', bodyHtml: '', styles: '.marker{color:red}' })
    expect(html).toContain('<style>')
    expect(html).toContain('.marker{color:red}')
  })

  it('escapes the title to keep the document well-formed', () => {
    const html = buildStandaloneHtml({ title: 'a<b>&"', bodyHtml: '', styles: '' })
    expect(html).toContain('<title>a&lt;b&gt;&amp;&quot;</title>')
    expect(html).not.toContain('<title>a<b>')
  })

  it('falls back to "untitled" when no title is given', () => {
    const html = buildStandaloneHtml({ title: '', bodyHtml: '', styles: '' })
    expect(html).toContain('<title>untitled</title>')
  })
})
