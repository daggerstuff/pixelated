import { describe, expect, it } from 'vitest'

import {
  getRequestHeader,
  getRequestHeaderEntries,
  normalizeRequestHeaders,
} from './request-headers'

describe('request header utilities', () => {
  it('reads values from Fetch Headers', () => {
    const headers = new Headers({
      'x-forwarded-for': '203.0.113.1, 198.51.100.2',
      'user-agent': 'fetch-agent',
    })

    expect(getRequestHeader(headers, 'x-forwarded-for')).toBe(
      '203.0.113.1, 198.51.100.2',
    )
    expect(getRequestHeader({ headers }, 'user-agent')).toBe('fetch-agent')
  })

  it('reads values from Node-style header records case-insensitively', () => {
    const request = {
      headers: {
        'x-forwarded-for': '203.0.113.4',
        'User-Agent': 'node-agent',
      },
    }

    expect(getRequestHeader(request, 'X-Forwarded-For')).toBe('203.0.113.4')
    expect(getRequestHeader(request, 'user-agent')).toBe('node-agent')
  })

  it('uses the first value from array headers', () => {
    const request = {
      headers: {
        'x-forwarded-for': ['203.0.113.5', '198.51.100.6'],
      },
    }

    expect(getRequestHeader(request, 'x-forwarded-for')).toBe('203.0.113.5')
  })

  it('returns entries without requiring Headers.entries', () => {
    const request = {
      headers: {
        'x-forwarded-for': '203.0.113.7',
        'user-agent': 'node-agent',
      },
    }

    expect(getRequestHeaderEntries(request)).toEqual([
      ['x-forwarded-for', '203.0.113.7'],
      ['user-agent', 'node-agent'],
    ])
  })

  it('normalizes plain request headers to Fetch-compatible Headers', () => {
    const request = {
      headers: {
        'x-forwarded-for': '203.0.113.8',
      },
    }

    normalizeRequestHeaders(request)

    expect(request.headers).toBeInstanceOf(Headers)
    expect(request.headers.get('x-forwarded-for')).toBe('203.0.113.8')
  })
})
