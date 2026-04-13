import { describe, it, expect } from 'vitest'
import { generateToc, type MarkdownHeading } from './toc'
import type { HeadingLevel } from '@/types'

describe('generateToc', () => {
  it('should throw an error if minHeadingLevel > maxHeadingLevel', () => {
    const minHeadingLevel: HeadingLevel = 3
    const maxHeadingLevel: HeadingLevel = 2
    expect(() => generateToc([], minHeadingLevel, maxHeadingLevel)).toThrowError('`minHeadingLevel` must be less than or equal to `maxHeadingLevel`')
  })

  it('should filter headings and build a hierarchical ToC', () => {
    const headings: MarkdownHeading[] = [
      { depth: 1, slug: '1', text: 'H1' },
      { depth: 2, slug: '2', text: 'H2' },
      { depth: 3, slug: '3', text: 'H3' },
      { depth: 2, slug: '4', text: 'H2-2' },
    ]
    const minHeadingLevel: HeadingLevel = 2
    const maxHeadingLevel: HeadingLevel = 3
    const toc = generateToc(headings, minHeadingLevel, maxHeadingLevel)

    expect(toc).toHaveLength(2)
    expect(toc[0].text).toBe('H2')
    expect(toc[0].children).toHaveLength(1)
    expect(toc[0].children[0].text).toBe('H3')
    expect(toc[1].text).toBe('H2-2')
  })

  it('should handle skipped heading levels with fillers', () => {
    const headings: MarkdownHeading[] = [
      { depth: 2, slug: 'h2', text: 'H2' },
      { depth: 4, slug: 'h4', text: 'H4' },
    ]
    const minHeadingLevel: HeadingLevel = 1
    const maxHeadingLevel: HeadingLevel = 6
    const toc = generateToc(headings, minHeadingLevel, maxHeadingLevel)

    expect(toc).toHaveLength(1)
    expect(toc[0].text).toBe('H2')
    expect(toc[0].children).toHaveLength(1)
    expect(toc[0].children[0].children).toHaveLength(1)
    expect(toc[0].children[0].children[0].text).toBe('H4')
  })
})