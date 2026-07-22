import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { generateId, memoize, validateFilename, tryRequireNode } from '../index'

describe('generateId', () => {
  it('generates a unique ID string', () => {
    const id = generateId()
    expect(id).toMatch(/^id_[a-z0-9]+$/)
    // Expect id_ + 26 chars (13+13 from two random strings)
    expect(id.length).toBeGreaterThan(20)
  })

  it('generates different IDs on consecutive calls', () => {
    const id1 = generateId()
    const id2 = generateId()
    expect(id1).not.toBe(id2)
  })
})

describe('memoize', () => {
  it('caches results for the same arguments', () => {
    const fn = vi.fn((x: number) => x * 2)
    const memoized = memoize(fn as (...args: unknown[]) => unknown)

    expect(memoized(5)).toBe(10)
    expect(memoized(5)).toBe(10)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('recomputes for different arguments', () => {
    const fn = vi.fn((x: number) => x * 2)
    const memoized = memoize(fn as (...args: unknown[]) => unknown)

    memoized(5)
    memoized(10)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('handles multiple arguments', () => {
    const fn = vi.fn((a: number, b: number) => a + b)
    const memoized = memoize(fn as (...args: unknown[]) => unknown)

    expect(memoized(1, 2)).toBe(3)
    expect(memoized(1, 2)).toBe(3)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('works with object arguments via JSON serialization', () => {
    const fn = vi.fn((obj: { x: number }) => obj.x * 2)
    const memoized = memoize(fn as (...args: unknown[]) => unknown)

    expect(memoized({ x: 5 })).toBe(10)
    expect(memoized({ x: 5 })).toBe(10)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('validateFilename', () => {
  it('accepts valid filenames', () => {
    expect(validateFilename('report.pdf')).toBe('report.pdf')
    expect(validateFilename('my-file_v2.test.js')).toBe('my-file_v2.test.js')
    expect(validateFilename('README.md')).toBe('README.md')
    expect(validateFilename('data_2026_01.json')).toBe('data_2026_01.json')
  })

  it('rejects filenames with invalid characters', () => {
    expect(() => validateFilename('report$.pdf')).toThrow(
      'Filename contains invalid characters',
    )
    expect(() => validateFilename('file#1.txt')).toThrow(
      'Filename contains invalid characters',
    )
  })

  it('rejects path traversal sequences', () => {
    // The pattern check catches `/` and `\` first, then the traversal check
    // catches paths that slip past (e.g. '..' alone would pass the pattern)
    expect(() => validateFilename('../../etc/passwd')).toThrow()
    expect(() => validateFilename('..\\windows\\system32')).toThrow()
  })

  it('rejects filenames with slashes', () => {
    // `/` is not in the allowlist pattern, so it fails the pattern check first
    expect(() => validateFilename('subdir/file.txt')).toThrow()
  })

  it('accepts custom allowed patterns', () => {
    const customPattern = /^[a-zA-Z0-9_-]+$/
    expect(validateFilename('custom_name', customPattern)).toBe('custom_name')
    expect(() => validateFilename('file.txt', customPattern)).toThrow(
      'Filename contains invalid characters',
    )
  })
})

describe('tryRequireNode', () => {
  beforeEach(() => {
    // Ensure global require is set to undefined for test environment
    const globalAny = globalThis as unknown as Record<string, unknown>
    globalAny['require'] = undefined
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null when require is not available', () => {
    const result = tryRequireNode('fs')
    expect(result).toBeNull()
  })

  it('returns null when require throws', () => {
    const mockRequire = vi.fn(() => {
      throw new Error('Module not found')
    })
    const globalAny = globalThis as unknown as Record<string, unknown>
    globalAny['require'] = mockRequire

    const result = tryRequireNode('nonexistent-module')
    expect(result).toBeNull()
    expect(mockRequire).toHaveBeenCalledWith('nonexistent-module')
  })

  it('returns the module when require succeeds', () => {
    const mockModule = { hello: 'world' }
    const mockRequire = vi.fn(() => mockModule)
    const globalAny = globalThis as unknown as Record<string, unknown>
    globalAny['require'] = mockRequire

    const result = tryRequireNode('some-module')
    expect(result).toBe(mockModule)
    expect(mockRequire).toHaveBeenCalledWith('some-module')
  })
})
