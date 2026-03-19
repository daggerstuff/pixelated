import { describe, it, expect } from 'vitest'
import { generateToc, type MarkdownHeading } from './toc'

describe('generateToc', () => {
  it('should filter headings outside the minHeadingLevel and maxHeadingLevel bounds', () => {
    const headings: MarkdownHeading[] = [
      { depth: 1, slug: 'h1', text: 'Heading 1' },
      { depth: 2, slug: 'h2', text: 'Heading 2' },
      { depth: 3, slug: 'h3', text: 'Heading 3' },
    ]

    const toc = generateToc(headings, 2, 2)

    expect(toc).toEqual([
      {
        depth: 2,
        slug: 'h2',
        text: 'Heading 2',
        children: [],
      },
    ])
  })
})
