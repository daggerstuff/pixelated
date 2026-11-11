/** @vitest-environment node */

/**
 * An outage is not a missing session, and a provider outage is not a sign-out
 * (VAL-UX-001).
 *
 * The pinned page (`session/[sessionId].astro`) caught *any* non-ok response
 * from the training data load, left `sessionData` undefined, and redirected to
 * `/training?error=session-not-found` — the same destination for a genuine 404
 * and for the 8 s deadline's 503. No file under `pages/training/` read a query
 * parameter, so the trainee saw no status message at all. The same page also
 * called `getSession` itself and redirected to `/login` when that second
 * validation failed on a provider error, converting an outage into a sign-out
 * even though the middleware had already resolved the token.
 *
 * Astro pages have no component test runner in this repository (see
 * `components/__tests__/AIChat.astro.test.ts` and
 * `lib/auth/__tests__/training-single-validation.test.ts`), so the page half of
 * this suite is a structural regression guard over the two pages' control flow.
 * It fails on the pinned code for the right reason: there is no status-driven
 * branch, no unavailable surface, and no query-parameter read. The status
 * mapping itself is a pure function and is exercised directly.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { classifyTrainingSessionLoad } from '../_session-load-state'

const readPage = (relativePath: string): string =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')

const sessionPage = readPage('../session/[sessionId].astro')
const indexPage = readPage('../index.astro')

/** The source of the session page's unavailable branch only. */
const unavailableBranch = (() => {
  const start = sessionPage.indexOf('{!sessionData ? (')
  const end = sessionPage.indexOf(') : (', start)
  return start === -1 || end === -1 ? '' : sessionPage.slice(start, end)
})()

const chromaticChrome =
  /\b(?:bg|text|border|ring)-(?:emerald|indigo|red|green|blue|amber|purple|slate|gray|neutral|teal|pink|rose|cyan|yellow|orange)-/

/** The source of the index page's not-found notice only. */
const indexNotice = (() => {
  const start = indexPage.indexOf('{sessionNotFound && (')
  const end = indexPage.indexOf(')}', start)
  return start === -1 || end === -1 ? '' : indexPage.slice(start, end)
})()

describe('classifyTrainingSessionLoad', () => {
  it('renders a deadline 503 as unavailable, not as an absent session', () => {
    expect(classifyTrainingSessionLoad(503, false)).toBe('unavailable')
  })

  it('renders every 5xx as unavailable — a server failure is never an absence', () => {
    for (const status of [500, 502, 503, 504]) {
      expect(classifyTrainingSessionLoad(status, false)).toBe('unavailable')
    }
  })

  it('keeps a genuine absence on the not-found path', () => {
    expect(classifyTrainingSessionLoad(404, false)).toBe('not-found')
  })

  it('keeps a refusal on the not-found path', () => {
    for (const status of [400, 401, 403]) {
      expect(classifyTrainingSessionLoad(status, false)).toBe('not-found')
    }
  })

  it('reads a 2xx with a training session as ready', () => {
    expect(classifyTrainingSessionLoad(200, true)).toBe('ready')
  })

  it('treats a 2xx without a training session as a temporary failure', () => {
    // A malformed 200 is a server-side failure, not an absence.
    expect(classifyTrainingSessionLoad(200, false)).toBe('unavailable')
  })

  it('treats a load that produced no status at all as a temporary failure', () => {
    expect(classifyTrainingSessionLoad(null, false)).toBe('unavailable')
  })
})

describe('training session page: status-driven error surface', () => {
  it('decides the surface from the underlying status', () => {
    // The pinned page treated every non-ok response as "not found".
    expect(sessionPage).toMatch(/classifyTrainingSessionLoad\(/)
    expect(sessionPage).toMatch(/response\.status/)

    // A 4xx keeps the not-found redirect.
    expect(sessionPage).toMatch(/error=session-not-found/)
  })

  it('renders an explicit temporary-unavailable message instead of redirecting', () => {
    expect(sessionPage).toMatch(
      /This training session is temporarily unavailable/i,
    )
    // The notice must say it is not a missing session, so the trainee does not
    // read the outage as data loss.
    expect(sessionPage).toMatch(/not a missing session/i)
  })

  it('offers a retry control that preserves the session URL', () => {
    // Retrying from the page's own URL keeps the trainee on
    // /training/session/<id>; no new route and no query contract is added.
    expect(sessionPage).toMatch(/href=\{Astro\.url\.pathname\}/)
    expect(sessionPage).toMatch(/Retry loading this session/i)
  })

  it('marks the unavailable response as retryable', () => {
    expect(sessionPage).toMatch(/Astro\.response\.status\s*=\s*503/)
    expect(sessionPage).toMatch(/Retry-After/)
  })

  it('treats a provider outage on its own session read as unavailable, not a logout', () => {
    // The middleware already resolved the token, so a null here is a provider
    // failure. The genuine no-session case keeps its /login redirect.
    expect(sessionPage).toMatch(/Astro\.locals\.user/)
    expect(sessionPage).toMatch(/\/login\?redirect=/)
  })

  it('selects the surface from the load state, never from the trainee role', () => {
    // The unavailable branch is chosen by the data-load outcome.
    expect(sessionPage).toMatch(/\{!?sessionData \? \(/)

    // It must render before the role gate, and the role gate must still guard
    // only the session UI.
    const unavailableIndex = sessionPage.indexOf('temporarily unavailable')
    const traineeGateIndex = sessionPage.indexOf('{isTrainee && (')
    expect(unavailableIndex).toBeGreaterThan(-1)
    expect(traineeGateIndex).toBeGreaterThan(-1)
    expect(unavailableIndex).toBeLessThan(traineeGateIndex)
  })

  it('keeps the design system on the unavailable surface', () => {
    expect(unavailableBranch).not.toBe('')
    // Zero-chroma: state is carried by value contrast, never by hue.
    expect(unavailableBranch).not.toMatch(chromaticChrome)
    // 0px radius and no shadows.
    expect(unavailableBranch).toContain('rounded-none')
    expect(unavailableBranch).not.toMatch(/\brounded-(?!none)/)
    expect(unavailableBranch).not.toMatch(/\bshadow-/)
    // 44px touch target on the retry control.
    expect(unavailableBranch).toContain('min-h-[44px]')
  })
})

describe('training index page: renders the session error state', () => {
  it('reads the error query parameter', () => {
    // Pinned: no file under pages/training/ read a query parameter, so the
    // redirect target rendered no status message.
    expect(indexPage).toMatch(/searchParams\.get\(['"]error['"]\)/)
  })

  it('renders a not-found notice for error=session-not-found', () => {
    expect(indexPage).toMatch(/could not be found/i)
    expect(indexPage).toMatch(/role="status"/)
  })

  it('renders the notice from the error state, not from a role check', () => {
    // The notice must come before the unreachable `userRole === 'trainee'`
    // branch and must not be gated on a role.
    const noticeIndex = indexPage.indexOf('could not be found')
    const roleGateIndex = indexPage.indexOf("userRole === 'trainee'")
    expect(noticeIndex).toBeGreaterThan(-1)
    expect(roleGateIndex).toBeGreaterThan(-1)
    expect(noticeIndex).toBeLessThan(roleGateIndex)
  })

  it('keeps the design system on the not-found notice', () => {
    expect(indexNotice).not.toBe('')
    expect(indexNotice).not.toMatch(chromaticChrome)
    expect(indexNotice).toContain('rounded-none')
    expect(indexNotice).not.toMatch(/\bshadow-/)
  })
})
