import { describe, it, expect } from 'vitest'
import { parseUserAgent } from './user-agent'

describe.skip('parseUserAgent', () => {
  it('returns empty object for missing/empty user agent', () => {
    expect(parseUserAgent('')).toEqual({})
    expect(parseUserAgent(null as any)).toEqual({})
  })

  it('detects browsers correctly', () => {
    expect(parseUserAgent('Mozilla/5.0 Firefox/90.0')).toMatchObject({ browser: 'Firefox' })
    expect(parseUserAgent('Mozilla/5.0 Edg/91.0')).toMatchObject({ browser: 'Edge' })
    expect(parseUserAgent('Mozilla/5.0 Chrome/91.0')).toMatchObject({ browser: 'Chrome' })
    expect(parseUserAgent('Mozilla/5.0 Safari/605.1.15')).toMatchObject({ browser: 'Safari' })
  })

  it('detects OS correctly', () => {
    expect(parseUserAgent('Mozilla/5.0 (Windows NT 10.0)')).toMatchObject({ os: 'Windows' })
    expect(parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toMatchObject({ os: 'macOS' })
    expect(parseUserAgent('Mozilla/5.0 (Android 10)')).toMatchObject({ os: 'Android' })
    expect(parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_6)')).toMatchObject({ os: 'iOS' })
    expect(parseUserAgent('Mozilla/5.0 (iPad; CPU OS 14_6)')).toMatchObject({ os: 'iOS' })
    expect(parseUserAgent('Mozilla/5.0 (X11; Linux x86_64)')).toMatchObject({ os: 'Linux' })
  })

  it('detects devices correctly', () => {
    expect(parseUserAgent('Mozilla/5.0 (iPhone; Mobile)')).toMatchObject({ device: 'Mobile' })
    expect(parseUserAgent('Mozilla/5.0 (iPad; Tablet)')).toMatchObject({ device: 'Tablet' })
    expect(parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toMatchObject({ device: 'Desktop' })
  })

  it('detects combinations correctly', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36'
    expect(parseUserAgent(ua)).toEqual({
      browser: 'Chrome', // Chrome comes first in the function's checks before Safari
      os: 'Android',
      device: 'Mobile'
    })
  })
})