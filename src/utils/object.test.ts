import { describe, it, expect } from 'vitest'

import { deepEqual, mergeValues } from './object'

describe('mergeValues', () => {
  it('deep merges objects handling primitives and nesting', () => {
    const local = { a: 1, b: { c: 2, d: 3 } }
    const remote = { b: { c: 9, e: 4 }, f: 5 }
    expect(mergeValues<any>(local, remote)).toEqual({
      a: 1,
      b: { c: 9, d: 3, e: 4 },
      f: 5,
    })
    expect(mergeValues(1, 2)).toBe(2)
    expect(mergeValues('x', 'y')).toBe('y')
  })

  it('merges arrays by identity key, preserving local order and updating/appending remote items', () => {
    const local = [
      { id: 1, val: 'a' },
      { id: 2, val: 'b' },
    ]
    const remote = [
      { id: 2, val: 'b-new' },
      { id: 3, val: 'c' },
    ]
    expect(mergeValues(local, remote)).toEqual([
      { id: 1, val: 'a' },
      { id: 2, val: 'b-new' },
      { id: 3, val: 'c' },
    ])
  })
})

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
    const obj1 = { a: 1, b: { c: [1, 2, 3], d: 'test' } }
    const obj2 = { a: 1, b: { c: [1, 2, 3], d: 'test' } }
    const obj3 = { a: 1, b: { c: [1, 2, 4], d: 'test' } }
    const obj4 = { a: 1, b: { c: [1, 2, 3] } }

    expect(deepEqual(obj1, obj2)).toBe(true)
    expect(deepEqual(obj1, obj3)).toBe(false)
    expect(deepEqual(obj1, obj4)).toBe(false)
  })

  it('handles edge cases like different types, array lengths, and key names', () => {
    // Type mismatches
    expect(deepEqual(1, '1' as any)).toBe(false)
    expect(deepEqual(true, false)).toBe(false)

    // Different array lengths
    expect(deepEqual([1, 2], [1])).toBe(false)
    expect(deepEqual([1], [1, 2])).toBe(false)

    // Objects with different keys but same key count
    expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false)
  })
})
