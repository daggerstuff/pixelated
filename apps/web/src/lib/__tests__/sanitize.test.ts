import { describe, it, expect } from 'vitest'

import { sanitizeUrl } from '../sanitize'

describe('sanitizeUrl', () => {
  it('returns valid absolute URLs unmodified', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com')
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com')
    expect(sanitizeUrl('ftp://example.com/file.txt')).toBe(
      'ftp://example.com/file.txt',
    )
    expect(sanitizeUrl('mailto:test@example.com')).toBe(
      'mailto:test@example.com',
    )
  })

  it('allows valid relative URLs', () => {
    expect(sanitizeUrl('/path/to/resource')).toBe('/path/to/resource')
    expect(sanitizeUrl('./relative/path')).toBe('./relative/path')
    expect(sanitizeUrl('../parent/path')).toBe('../parent/path')
    expect(sanitizeUrl('#anchor-link')).toBe('#anchor-link')
  })

  it('rejects dangerous and invalid URLs', () => {
    expect(sanitizeUrl('javascript:alert("XSS")')).toBe('#')
    expect(sanitizeUrl('data:text/html,<script>alert("XSS")</script>')).toBe(
      '#',
    )
    expect(sanitizeUrl('vbscript:msgbox("XSS")')).toBe('#')
    expect(sanitizeUrl('//protocol-relative.com')).toBe('#')
    expect(sanitizeUrl('unknown-protocol://example.com')).toBe('#')
  })

  it('handles empty and whitespace-only strings', () => {
    expect(sanitizeUrl('')).toBe('#')
    expect(sanitizeUrl('   ')).toBe('#')
  })

  it('trims leading and trailing whitespace from valid URLs', () => {
    expect(sanitizeUrl('  https://example.com  ')).toBe('https://example.com')
  })
})
