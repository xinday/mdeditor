import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildStandaloneHtml, printHtml } from './exporter.js'

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

describe('printHtml', () => {
  afterEach(() => {
    document.querySelectorAll('iframe.export-print-frame').forEach((f) => f.remove())
  })

  it('appends a hidden iframe carrying the html and returns it', () => {
    const html = '<!doctype html><title>t</title>'
    const iframe = printHtml(html)
    expect(iframe.tagName).toBe('IFRAME')
    expect(iframe.getAttribute('srcdoc')).toBe(html)
    expect(document.body.contains(iframe)).toBe(true)
    expect(iframe.style.position).toBe('fixed')
  })

  it('prints the iframe and removes it after printing', () => {
    const iframe = printHtml('<!doctype html>')
    const print = vi.fn()
    const focus = vi.fn()
    let afterprintCb = null
    const fakeWin = {
      focus,
      print,
      addEventListener: (type, cb) => { if (type === 'afterprint') afterprintCb = cb },
    }
    Object.defineProperty(iframe, 'contentWindow', { value: fakeWin, configurable: true })
    iframe.dispatchEvent(new Event('load'))
    expect(focus).toHaveBeenCalled()
    expect(print).toHaveBeenCalledTimes(1)
    expect(document.body.contains(iframe)).toBe(true)
    afterprintCb()
    expect(document.body.contains(iframe)).toBe(false)
  })
})
