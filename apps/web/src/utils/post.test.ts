import { describe, it, expect } from 'vitest'

import { filterDrafts, sortByDate, sortPosts, filterDraftPosts } from './post'

describe('post utils', () => {
  it('filterDrafts should remove draft posts', () => {
    const posts: any[] = [
      { id: '1', data: { draft: true, title: 'Draft' } },
      { id: '2', data: { draft: false, title: 'Published' } },
      { id: '3', data: { title: 'No draft field' } },
    ]

    const filtered = filterDrafts(posts)
    expect(filtered).toHaveLength(2)
    expect(filtered[0].id).toBe('2')
    expect(filtered[1].id).toBe('3')
  })

  it('filterDraftPosts should return true for non-drafts', () => {
    const fn = filterDraftPosts()
    expect(fn({ id: '1', data: { draft: true } } as any)).toBe(false)
    expect(fn({ id: '2', data: { draft: false } } as any)).toBe(true)
    expect(fn({ id: '3', data: {} } as any)).toBe(true)
  })

  it('sortByDate and sortPosts should sort correctly from newest to oldest', () => {
    const posts: any[] = [
      { id: '1', data: { pubDate: new Date('2023-01-01') } },
      { id: '2', data: { pubDate: new Date('2023-01-03') } },
      { id: '3', data: { pubDate: new Date('2023-01-02') } },
    ]

    const sorted1 = sortByDate([...posts])
    expect(sorted1[0].id).toBe('2')
    expect(sorted1[1].id).toBe('3')
    expect(sorted1[2].id).toBe('1')

    const sorted2 = sortPosts([...posts])
    expect(sorted2[0].id).toBe('2')
    expect(sorted2[1].id).toBe('3')
    expect(sorted2[2].id).toBe('1')
  })
})
