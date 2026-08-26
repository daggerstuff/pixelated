/** @vitest-environment node */
import { describe, it, expect } from 'vitest'

import { processContent } from './search-indexer'

describe('processContent', () => {
  it('handles empty string gracefully', () => {
    expect(processContent('')).toBe('')
  })

  it('removes frontmatter from content', () => {
    const input = `---
title: "Hello"
date: "2023-01-01"
---
# Heading 1
Content here`
    const output = processContent(input)
    expect(output).toBe('Heading 1 Content here')
  })

  it('removes HTML tags from content', () => {
    const input = `<div><p>This is a <strong>test</strong>.</p></div>`
    const output = processContent(input)
    expect(output).toBe('This is a test .')
  })

  it('removes Markdown syntax from content', () => {
    const input = `This is **bold** and *italic*. It has ~~strikethrough~~ and \`inline code\`.`
    const output = processContent(input)
    expect(output).toBe(
      'This is bold and italic. It has strikethrough and inline code.',
    )
  })
})
