import { describe, expect, it } from 'vitest'

import { scrub } from '../scrub'

describe('log scrubbing', () => {
  it('redacts sensitive keys regardless of case or separator style', () => {
    const input = {
      password: 'hunter2',
      accessToken: 'abc',
      refreshToken: 'abc',
      api_key: 'k',
      APIKEY: 'k',
      authorization: 'Bearer x',
      'session-id': 's',
      userJWT: 'j',
      patient_name: 'Alice',
      dateOfBirth: '2000-01-01',
      safe: 'value',
      count: 3,
    }
    const out = scrub(input) as Record<string, unknown>
    for (const key of Object.keys(input)) {
      if (['safe', 'count'].includes(key)) continue
      expect(out[key]).toBe('[REDACTED]')
    }
    expect(out.safe).toBe('value')
    expect(out.count).toBe(3)
  })

  it('masks emails and bearer credentials inside string values', () => {
    // Fake fixture values only: the .invalid TLD is RFC 2606 reserved, and the
    // token is a literal placeholder. This test exists to prove they get masked.
    const out = scrub('login failed for user@example.invalid with Bearer placeholder-credential-value') as string
    expect(out).not.toContain('user@example.invalid')
    expect(out).not.toContain('placeholder-credential-value')
    expect(out).toContain('[REDACTED-EMAIL]')
    expect(out).toContain('[REDACTED-CREDENTIAL]')
  })

  it('scrubs nested objects and arrays without mutating the input', () => {
    const input = { outer: { inner: [{ secretToken: 'x' }] }, list: ['ok'] }
    const snapshot = JSON.stringify(input)
    const out = scrub(input) as { outer: { inner: Array<{ secretToken: string }> } }
    expect(out.outer.inner[0].secretToken).toBe('[REDACTED]')
    expect(JSON.stringify(input)).toBe(snapshot)
  })

  it('passes primitives through, but scrubs strings', () => {
    expect(scrub(null)).toBe(null)
    expect(scrub(42)).toBe(42)
    expect(scrub(true)).toBe(true)
    expect(scrub('token=abc')).toBe('token=abc')
  })

  it('leaves Error and Date instances intact', () => {
    const error = new Error('boom')
    const date = new Date('2024-01-01')
    expect(scrub(error)).toBe(error)
    expect(scrub(date)).toBe(date)
  })

  it('stops at a bounded depth', () => {
    let deep: Record<string, unknown> = { password: 'x' }
    for (let i = 0; i < 10; i++) deep = { nested: deep }
    const out = scrub(deep) as Record<string, unknown>
    let node: unknown = out
    for (let i = 0; i < 4; i++) {
      expect(node).not.toBe('[REDACTED]')
      node = (node as Record<string, unknown>).nested
    }
    expect(node).toBe('[REDACTED]')
  })
})
