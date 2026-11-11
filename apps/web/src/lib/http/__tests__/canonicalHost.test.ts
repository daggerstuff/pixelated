/* @vitest-environment node */

import { describe, expect, it } from 'vitest'

import { canonicalHostRedirect } from '../canonicalHost'

describe('canonicalHostRedirect', () => {
  it('redirects www to the apex and keeps path and query', () => {
    const target = canonicalHostRedirect(
      new URL('https://www.pixelatedempathy.com/pricing?plan=team'),
    )

    expect(target?.toString()).toBe(
      'https://pixelatedempathy.com/pricing?plan=team',
    )
  })

  it('redirects a www root request to the apex root', () => {
    expect(
      canonicalHostRedirect(
        new URL('https://www.pixelatedempathy.com/'),
      )?.toString(),
    ).toBe('https://pixelatedempathy.com/')
  })

  it('drops a dev port so the canonical host is not served on one', () => {
    const target = canonicalHostRedirect(
      new URL('http://www.pixelatedempathy.com:8788/api/health'),
    )

    expect(target?.host).toBe('pixelatedempathy.com')
    expect(target?.protocol).toBe('https:')
  })

  it('leaves the apex alone', () => {
    expect(
      canonicalHostRedirect(new URL('https://pixelatedempathy.com/training')),
    ).toBeNull()
  })

  it('leaves other subdomains alone', () => {
    expect(
      canonicalHostRedirect(new URL('https://analytics.pixelatedempathy.com/')),
    ).toBeNull()
    expect(
      canonicalHostRedirect(new URL('https://wwwx.example.com/')),
    ).toBeNull()
  })
})
