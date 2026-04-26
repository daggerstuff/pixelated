import { describe, expect, it } from 'vitest'

import { unescapeHTML, slug } from './common'

describe('common utilities - slug', () => {
  it('handles edge cases like multiple spaces, special characters, and trailing hyphens', () => {
    expect(slug('  Hello   World!  ')).toBe('hello-world')
    expect(slug('Special @ Characters #1')).toBe('special-characters-1')
    expect(slug('---Leading and Trailing---')).toBe('leading-and-trailing')
  })
})

describe('common utilities - unescapeHTML', () => {
  it('unescapes all common HTML entities in string children', () => {
    const node = {
      type: 'div',
      children:
        '&lt;b&gt;bold&lt;/b&gt; &amp; &quot;beautiful&quot; &#039;quotes&#039; &#x2F;slash&#x2F; &#x3D;equal&#x3D;',
    }
    const result = unescapeHTML(node as any)
    expect(result.children).toBe(
      '<b>bold</b> & "beautiful" \'quotes\' /slash/ =equal=',
    )
  })

  it('processes array of strings without unescaping them (limited to children objects/strings)', () => {
    // Current implementation only unescapes if children IS a string or recursively if child is an object
    const node = {
      type: 'div',
      children: ['&lt;b&gt;', 'plain text'],
    }
    const result = unescapeHTML(node as any)
    expect(result.children).toEqual(['&lt;b&gt;', 'plain text'])
  })

  it('recursively unescapes nested VNode objects in an array', () => {
    const node = {
      type: 'div',
      children: [
        { type: 'span', children: '&amp;' },
        { type: 'p', children: '&lt;inside&gt;' },
      ],
    }
    const result = unescapeHTML(node as any)
    expect((result.children as any[])[0].children).toBe('&')
    expect((result.children as any[])[1].children).toBe('<inside>')
  })

  it('handles deeply nested VNodes', () => {
    const node = {
      type: 'root',
      children: {
        type: 'level1',
        children: {
          type: 'level2',
          children: '&quot;deep&quot;',
        },
      },
    }
    const result = unescapeHTML(node as any)
    expect(((result.children as any).children as any).children).toBe('"deep"')
  })

  it('handles null or undefined nodes gracefully', () => {
    expect(unescapeHTML(null as any)).toBeNull()
    expect(unescapeHTML(undefined as any)).toBeUndefined()
  })

  it('handles nodes with no children property', () => {
    const node = { type: 'br' }
    const result = unescapeHTML(node as any)
    expect(result).toEqual({ type: 'br' })
  })

  it('handles empty children string', () => {
    const node = { type: 'div', children: '' }
    const result = unescapeHTML(node as any)
    expect(result.children).toBe('')
  })

  it('ensures original node is not mutated (returns new object)', () => {
    const node = { type: 'div', children: '&amp;' }
    const result = unescapeHTML(node as any)

    expect(result).not.toBe(node)
    expect(node.children).toBe('&amp;')
    expect(result.children).toBe('&')
  })
})
