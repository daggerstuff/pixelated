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

  it('handles nested objects and arrays', () => {
    const objA = { id: 1, items: [1, 2, { name: 'test' }] }
    const objB = { id: 1, items: [1, 2, { name: 'test' }] }
    const objC = { id: 1, items: [1, 2, { name: 'different' }] }

    expect(deepEqual(objA, objB)).toBe(true)
    expect(deepEqual(objA, objC)).toBe(false)
    expect(deepEqual(objA, { ...objA, extra: true } as any)).toBe(false)
  })
})
