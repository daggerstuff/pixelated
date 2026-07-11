import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { getEnvironmentVariable, isNodeEnvironment } from '../environment'

describe('getEnvironmentVariable', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should return the environment variable value when it exists', () => {
    process.env['PUBLIC_SITE_URL'] = 'https://example.com'
    const result = getEnvironmentVariable('PUBLIC_SITE_URL')
    expect(result).toBe('https://example.com')
  })

  it('should return the default value when the environment variable does not exist', () => {
    delete process.env['PUBLIC_SITE_URL']
    const result = getEnvironmentVariable(
      'PUBLIC_SITE_URL',
      'https://default.com' as any,
    )
    expect(result).toBe('https://default.com')
  })

  it('should return undefined when the environment variable does not exist and no default value is provided', () => {
    delete process.env['PUBLIC_SITE_URL']
    const result = getEnvironmentVariable('PUBLIC_SITE_URL')
    expect(result).toBeUndefined()
  })
})

describe('Environment Validation', () => {
  describe('isNodeEnvironment', () => {
    it('should validate valid environment names', () => {
      // Need to import first

      expect(isNodeEnvironment('development')).toBe(true)
      expect(isNodeEnvironment('production')).toBe(true)
      expect(isNodeEnvironment('test')).toBe(true)
      expect(isNodeEnvironment('staging')).toBe(true)
    })

    it('should reject invalid environment names', () => {

      expect(isNodeEnvironment('dev')).toBe(false)
      expect(isNodeEnvironment('prod')).toBe(false)
      expect(isNodeEnvironment('testing')).toBe(false)
      expect(isNodeEnvironment('local')).toBe(false)
      expect(isNodeEnvironment('')).toBe(false)
      // @ts-expect-error - testing invalid type
      expect(isNodeEnvironment(undefined)).toBe(false)
      // @ts-expect-error - testing invalid type
      expect(isNodeEnvironment(null)).toBe(false)
    })
  })
})
