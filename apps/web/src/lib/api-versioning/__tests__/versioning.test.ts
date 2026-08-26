import { describe, it, expect } from 'vitest'

import {
  API_VERSION,
  API_VERSION_HEADER,
  DEPRECATION_HEADER,
  SUNSET_HEADER,
  ACCEPT_VERSION_HEADER,
  isApiRoute,
  extractVersionFromPath,
  getApiVersion,
  setVersionHeader,
  setDeprecationHeaders,
  createDeprecationInfo,
  getVersionStatus,
} from '../versioning'
import type { DeprecationInfo } from '../versioning'

describe('API Versioning Constants', () => {
  it('should have API_VERSION = 1', () => {
    expect(API_VERSION).toBe(1)
  })

  it('should have correct header names', () => {
    expect(API_VERSION_HEADER).toBe('X-API-Version')
    expect(DEPRECATION_HEADER).toBe('Deprecation')
    expect(SUNSET_HEADER).toBe('Sunset')
    expect(ACCEPT_VERSION_HEADER).toBe('Accept-Version')
  })
})

describe('isApiRoute', () => {
  it('should return true for /api/ paths', () => {
    expect(isApiRoute('/api/v1/health')).toBe(true)
    expect(isApiRoute('/api/sessions/123')).toBe(true)
    expect(isApiRoute('/api/')).toBe(true)
  })

  it('should return false for non-API paths', () => {
    expect(isApiRoute('/admin/dashboard')).toBe(false)
    expect(isApiRoute('/docs/api/reference')).toBe(false)
    expect(isApiRoute('/')).toBe(false)
  })
})

describe('extractVersionFromPath', () => {
  it('should extract version from /api/v{N}/...', () => {
    expect(extractVersionFromPath('/api/v1/health')).toBe(1)
    expect(extractVersionFromPath('/api/v2/sessions/123')).toBe(2)
    expect(extractVersionFromPath('/api/v10/admin/stats')).toBe(10)
  })

  it('should return null for unversioned paths', () => {
    expect(extractVersionFromPath('/api/health')).toBeNull()
    expect(extractVersionFromPath('/api/sessions/123')).toBeNull()
  })

  it('should return null for non-API paths', () => {
    expect(extractVersionFromPath('/admin/dashboard')).toBeNull()
    expect(extractVersionFromPath('/')).toBeNull()
  })

  it('should not match version without trailing slash', () => {
    expect(extractVersionFromPath('/api/v1')).toBeNull()
  })
})

describe('getApiVersion', () => {
  it('should prefer path version over header', () => {
    const headers = new Headers({ [ACCEPT_VERSION_HEADER]: '2' })
    const result = getApiVersion('/api/v1/health', headers)
    expect(result.version).toBe(1)
    expect(result.source).toBe('path')
  })

  it('should use header version when path is unversioned', () => {
    const headers = new Headers({ [ACCEPT_VERSION_HEADER]: '2' })
    const result = getApiVersion('/api/health', headers)
    expect(result.version).toBe(2)
    expect(result.source).toBe('header')
  })

  it('should default to API_VERSION when no version specified', () => {
    const result = getApiVersion('/api/health')
    expect(result.version).toBe(API_VERSION)
    expect(result.source).toBe('default')
  })

  it('should default when header value is invalid', () => {
    const headers = new Headers({ [ACCEPT_VERSION_HEADER]: 'invalid' })
    const result = getApiVersion('/api/health', headers)
    expect(result.version).toBe(API_VERSION)
    expect(result.source).toBe('default')
  })
})

describe('setVersionHeader', () => {
  it('should set X-API-Version on response', () => {
    const response = new Response('{}')
    setVersionHeader(response, 1)
    expect(response.headers.get(API_VERSION_HEADER)).toBe('1')
  })

  it('should default to API_VERSION', () => {
    const response = new Response('{}')
    setVersionHeader(response)
    expect(response.headers.get(API_VERSION_HEADER)).toBe(String(API_VERSION))
  })
})

describe('setDeprecationHeaders', () => {
  it('should set Deprecation and Sunset headers', () => {
    const response = new Response('{}')
    const info: DeprecationInfo = {
      version: 1,
      deprecatedAt: '2026-07-23',
      sunsetAt: '2027-01-31',
    }
    setDeprecationHeaders(response, info)
    expect(response.headers.get(DEPRECATION_HEADER)).toBe('2026-07-23')
    expect(response.headers.get(SUNSET_HEADER)).toBe('2027-01-31')
  })

  it('should set replacement version header when provided', () => {
    const response = new Response('{}')
    const info: DeprecationInfo = {
      version: 1,
      deprecatedAt: '2026-07-23',
      sunsetAt: '2027-01-31',
      replacementVersion: 2,
    }
    setDeprecationHeaders(response, info)
    expect(response.headers.get('X-API-Replacement-Version')).toBe('2')
  })
})

describe('createDeprecationInfo', () => {
  it('should create info with 6-month sunset by default', () => {
    const info = createDeprecationInfo(1)
    expect(info.version).toBe(1)
    expect(info.deprecatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(info.sunsetAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    // Sunset should be ~6 months after deprecation
    const deprecated = new Date(info.deprecatedAt)
    const sunset = new Date(info.sunsetAt)
    const diffMonths =
      (sunset.getFullYear() - deprecated.getFullYear()) * 12 +
      (sunset.getMonth() - deprecated.getMonth())
    expect(diffMonths).toBe(6)
  })

  it('should support custom notice period', () => {
    const info = createDeprecationInfo(1, 3)
    const deprecated = new Date(info.deprecatedAt)
    const sunset = new Date(info.sunsetAt)
    const diffMonths =
      (sunset.getFullYear() - deprecated.getFullYear()) * 12 +
      (sunset.getMonth() - deprecated.getMonth())
    expect(diffMonths).toBe(3)
  })

  it('should include replacement version when provided', () => {
    const info = createDeprecationInfo(1, 6, 2)
    expect(info.replacementVersion).toBe(2)
  })
})

describe('getVersionStatus', () => {
  it('should return active for current version', () => {
    expect(getVersionStatus(API_VERSION)).toBe('active')
  })

  it('should return deprecated for previous version', () => {
    expect(getVersionStatus(API_VERSION - 1)).toBe('deprecated')
  })

  it('should return retired for older versions', () => {
    expect(getVersionStatus(API_VERSION - 2)).toBe('retired')
    expect(getVersionStatus(-1)).toBe('retired')
  })

  it('should return retired for future versions', () => {
    expect(getVersionStatus(API_VERSION + 1)).toBe('retired')
  })
})
