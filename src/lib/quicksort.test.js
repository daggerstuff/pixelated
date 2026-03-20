import { describe, expect, it } from 'vitest'
import { quicksort } from './quicksort.js'

describe('quicksort', () => {
  it('should throw TypeError if input is not an array', () => {
    expect(() => quicksort('not an array')).toThrow(TypeError)
  })
})
