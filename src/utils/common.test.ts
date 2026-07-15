/* @vitest-environment node */
import { describe, expect, it } from 'vitest'

import { unescapeHTML, slug, type VNode } from './common'

describe('common utilities - slug', () => {
  it('handles edge cases like multiple spaces, special characters, and trailing hyphens', () => {
    expect(slug('  Hello   World!  ')).toBe('hello-world')
    expect(slug('Special @ Characters #1')).toBe('special-characters-1')
    expect(slug('---Leading and Trailing---')).toBe('leading-and-trailing')
  })
})

describe('common utilities - unescapeHTML', () => {
  const isVNode = (value: unknown): value is VNode =>
    value !== null &&
    value !== undefined &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'type' in value

  const toVNode = (value: VNode | null | undefined): VNode => {
    if (value === null || value === undefined) {
      throw new Error('Expected unescapeHTML to return a VNode')
    }

    return value
  }

  it('unescapes all common HTML entities in string children', () => {
    const node: VNode = {
      type: 'div',
      children:
        '&lt;b&gt;bold&lt;/b&gt; &amp; &quot;beautiful&quot; &#039;quotes&#039; &#x2F;slash&#x2F; &#x3D;equal&#x3D;',
    }
    const result: VNode = toVNode(unescapeHTML(node))
    expect(result.children).toBe(
      '<b>bold</b> & "beautiful" \'quotes\' /slash/ =equal=',
    )
  })

  it('processes array of strings without unescaping them (limited to children objects/strings)', () => {
    // Current implementation only unescapes if children IS a string or recursively if child is an object
    const node: VNode = {
      type: 'div',
      children: ['&lt;b&gt;', 'plain text'],
    }
    const result: VNode = toVNode(unescapeHTML(node))
    expect(result.children).toEqual(['&lt;b&gt;', 'plain text'])
  })

  it('recursively unescapes nested VNode objects in an array', () => {
    const node: VNode = {
      type: 'div',
      children: [
        { type: 'span', children: '&amp;' },
        { type: 'p', children: '&lt;inside&gt;' },
      ],
    }
    const result: VNode = toVNode(unescapeHTML(node))
    if (!Array.isArray(result.children)) {
      throw new Error('Expected result.children to be an array')
    }

    const firstChild = result.children[0]
    const secondChild = result.children[1]

    if (!isVNode(firstChild) || !isVNode(secondChild)) {
      throw new Error('Expected array children to be VNode values')
    }

    expect(firstChild.children).toBe('&')
    expect(secondChild.children).toBe('<inside>')
  })

  it('handles deeply nested VNodes', () => {
    const node: VNode = {
      type: 'root',
      children: {
        type: 'level1',
        children: {
          type: 'level2',
          children: '&quot;deep&quot;',
        },
      },
    }
    const result: VNode = toVNode(unescapeHTML(node))
    if (!isVNode(result.children)) {
      throw new Error('Expected result.children to be a VNode')
    }

    const level1 = result.children
    if (!isVNode(level1.children)) {
      throw new Error('Expected result.children.children to be a VNode')
    }

    expect(level1.children.children).toBe('"deep"')
  })

  it('handles null or undefined nodes gracefully', () => {
    expect(unescapeHTML(null)).toBeNull()
    expect(unescapeHTML(undefined)).toBeUndefined()
  })

  it('handles nodes with no children property', () => {
    const node: VNode = { type: 'br' }
    const result: VNode = toVNode(unescapeHTML(node))
    expect(result).toEqual({ type: 'br' })
  })

  it('handles empty children string', () => {
    const node: VNode = { type: 'div', children: '' }
    const result: VNode = toVNode(unescapeHTML(node))
    expect(result.children).toBe('')
  })

  it('ensures original node is not mutated (returns new object)', () => {
    const node: VNode = { type: 'div', children: '&amp;' }
    const result: VNode = toVNode(unescapeHTML(node))

    expect(result).not.toBe(node)
    expect(node.children).toBe('&amp;')
    expect(result.children).toBe('&')
  })
})
