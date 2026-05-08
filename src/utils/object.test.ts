import { describe, it, expect } from 'vitest'
import { deepEqual } from './object'

describe('deepEqual', () => {
  it('handles empty inputs', () => {
    expect(deepEqual({}, {})).toBe(true)
    expect(deepEqual([], [])).toBe(true)
    expect(deepEqual('', '')).toBe(true)
  })

  it('handles null and undefined', () => {
    expect(deepEqual(null, null)).toBe(true)
    expect(deepEqual(undefined, undefined)).toBe(true)
    expect(deepEqual(null, undefined)).toBe(false)
    expect(deepEqual(undefined, null)).toBe(false)
    expect(deepEqual(null, {})).toBe(false)
  })
})
