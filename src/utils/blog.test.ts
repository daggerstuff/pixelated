import { describe, expect, it } from 'vitest'
import { calculateReadingTime } from './blog'

describe('calculateReadingTime', () => {
  it('returns 0 for an empty string', () => {
    expect(calculateReadingTime('')).toBe(0)
  })

  it('calculates reading time correctly for text', () => {
    const text = new Array(400).fill('word').join(' ')
    expect(calculateReadingTime(text)).toBe(2)
  })

  it('handles null or undefined input', () => {
    // @ts-expect-error Testing invalid input
    expect(calculateReadingTime(null)).toBe(0)
    // @ts-expect-error Testing invalid input
    expect(calculateReadingTime(undefined)).toBe(0)
  })
})
