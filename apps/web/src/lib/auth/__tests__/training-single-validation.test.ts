/** @vitest-environment node */

/**
 * `/training` must validate the token once per load (diagnosis D7).
 *
 * `training/index.astro` called `isAuthenticated(request)` and then
 * `getCurrentUser(request)`. Each runs its own `validateToken`, so together
 * with the middleware's call the page validated the same token three times and
 * each validation costs a `/userinfo` request against a 10-request bucket. All
 * 10 observed `/training` redirects logged three completed validations and no
 * deadline: the page's own first two calls exhausted the budget its third call
 * needed, and the third call's failure sent the user to `/login`.
 *
 * Astro pages have no component test runner in this repository (see
 * `components/__tests__/AIChat.astro.test.ts`), so this is a structural
 * regression guard over the page's auth block. It fails on the pinned code for
 * the right reason: the page called `isAuthenticated`.
 */

import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const pagePath = new URL('../../../pages/training/index.astro', import.meta.url)
const source = readFileSync(pagePath, 'utf8')

describe('training page auth', () => {
  it('validates the token once instead of twice', () => {
    // One page-level read, through the helper that consumes the middleware's
    // verdict; neither `getCurrentUser` nor `isAuthenticated` re-validates.
    const helperCalls = source.match(/resolvePageSession\s*\(/g) ?? []

    expect(helperCalls).toHaveLength(1)
    expect(source).not.toMatch(/\bgetCurrentUser\s*\(/)
    // The removed second validation was `isAuthenticated(request)`.
    expect(source).not.toMatch(/\bisAuthenticated\s*\(/)
  })

  it('serves a developer key when the request carries no token', () => {
    expect(source).toMatch(/developer\?\.role/)
  })

  it('derives the authenticated state from the single result', () => {
    // The redirect must be driven by the one page-session result, not by a
    // second helper that validates the token again.
    expect(source).toMatch(
      /const \{ session, providerUnavailable, developer \} =\s*await resolvePageSession\(/,
    )
    expect(source).toMatch(/if \(!userRole\)/)
  })

  it('answers a retryable 503 rather than a /login redirect when the provider cannot verify', () => {
    // The middleware already resolved this token for the request. If the
    // page's own validation now fails, that is a transient provider failure,
    // not a logout.
    // The retryable 503 has one owner, and it must be produced inside the
    // outage branch: an unconditional response would also satisfy a bare
    // search for the status.
    expect(source).toMatch(
      /if \(providerUnavailable\) \{\s*return providerUnavailableResponse\(Astro\.url\.pathname\)/,
    )
    expect(source).not.toMatch(/status:\s*503/)
    expect(source).toMatch(
      /return Astro\.redirect\('\/login\?redirect=\/training'\)/,
    )
  })
})
