import { describe, expect, it } from 'vitest'

import {
  dedupeComments,
  InMemoryProcessedCommentStore,
} from './processed-comments'

describe('InMemoryProcessedCommentStore', () => {
  it('tracks added ids', () => {
    const store = new InMemoryProcessedCommentStore()
    expect(store.has('1')).toBe(false)
    store.add('1')
    expect(store.has('1')).toBe(true)
    expect(store.ids()).toEqual(['1'])
  })
})

describe('dedupeComments', () => {
  it('marks all fresh on first pass and skips them on the second', () => {
    const store = new InMemoryProcessedCommentStore()
    const comments = [{ id: 'a' }, { id: 'b' }]
    const first = dedupeComments(comments, store)
    expect(first.fresh.map((c) => c.id)).toEqual(['a', 'b'])
    expect(first.alreadyProcessed).toEqual([])
    const second = dedupeComments(comments, store)
    expect(second.fresh).toEqual([])
    expect(second.alreadyProcessed).toEqual(['a', 'b'])
  })

  it('splits mixed batches', () => {
    const store = new InMemoryProcessedCommentStore()
    store.add('seen')
    const result = dedupeComments([{ id: 'seen' }, { id: 'new' }], store)
    expect(result.fresh.map((c) => c.id)).toEqual(['new'])
    expect(result.alreadyProcessed).toEqual(['seen'])
  })
})
