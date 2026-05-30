import { describe, it, expect } from 'vitest'

import { quicksort } from './quicksort.js'

describe('quicksort', () => {
  it('should handle an empty array', () => {
    expect(quicksort([])).toEqual([])
  })

  it('should handle an array with duplicate elements', () => {
    expect(quicksort([3, 1, 3, 2, 1])).toEqual([1, 1, 2, 3, 3])
  })
})
