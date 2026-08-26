import { describe, it, expect, vi } from 'vitest'

// Mock astro:config/server before importing the path module
vi.mock('astro:config/server', () => ({
  base: '/app-base',
}))

import { withBasePath, ensureTrailingSlash, resolvePath } from './path'

describe('path utilities', () => {
  describe('ensureTrailingSlash', () => {
    it('adds a trailing slash if missing', () => {
      expect(ensureTrailingSlash('/test')).toBe('/test/')
      expect(ensureTrailingSlash('test')).toBe('test/')
      expect(ensureTrailingSlash('')).toBe('/')
    })

    it('does not add a trailing slash if already present', () => {
      expect(ensureTrailingSlash('/test/')).toBe('/test/')
      expect(ensureTrailingSlash('test/')).toBe('test/')
      expect(ensureTrailingSlash('/')).toBe('/')
    })
  })

  describe('withBasePath', () => {
    it('joins segments with base path', () => {
      expect(withBasePath('test')).toBe('/app-base/test')
      expect(withBasePath('/test')).toBe('/app-base/test')
    })

    it('deduplicates slashes', () => {
      expect(withBasePath('/test//path')).toBe('/app-base/test/path')
      expect(withBasePath('//test/')).toBe('/app-base/test/')
    })
  })

  describe('resolvePath', () => {
    it('resolves a pathname by appending trailing slash and joining with base path', () => {
      expect(resolvePath('test')).toBe('/app-base/test/')
      expect(resolvePath('/test')).toBe('/app-base/test/')
      expect(resolvePath('/test/')).toBe('/app-base/test/')
    })
  })
})
