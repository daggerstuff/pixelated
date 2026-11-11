/** @vitest-environment node */

/**
 * Faculty access uses one role name, and the dead supervisor handler is gone
 * (VAL-L04-008).
 *
 * On the pinned release the two training surfaces disagreed about who is
 * faculty. `training/index.astro` gated its supervisor entry point on
 * `userRole === 'supervisor'`, while `session/[sessionId].astro` gated the
 * supervisor branch on `userRole === 'admin'`. `session.user.role` is an
 * `AuthRole` — `admin | staff | therapist | user | guest`
 * (`apps/web/src/config/auth.config.ts`) — so `supervisor` is a value the gate
 * can never see and the index page's branch could never render. The same
 * release shipped `handleSupervisorIntervention` in
 * `public/js/training-session.js`, which called `this.showSupervisorMessage(...)`
 * — a method the script does not define. The handler had no caller, so the
 * `TypeError` stayed latent instead of failing loudly.
 *
 * Astro pages have no component test runner in this repository (see
 * `trainee-error-surface.test.ts`), so the page half is a structural guard over
 * the two page sources. The script half parses the class the page loads.
 *
 * The role mapping itself is out of scope and must stay unchanged: this suite
 * asserts what the training surfaces check, not what Auth0 returns.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const readFile = (relativePath: string): string =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')

const indexPage = readFile('../index.astro')
const sessionPage = readFile('../session/[sessionId].astro')
const trainingScript = readFile('../../../../public/js/training-session.js')

/** Every role name a page compares `userRole` against. */
const roleComparisons = (source: string): string[] =>
  [...source.matchAll(/userRole\s*===\s*'([a-z]+)'/g)].map((match) => match[1])

describe('faculty role vocabulary', () => {
  it('gates faculty access with `admin` on both training surfaces', () => {
    expect(roleComparisons(indexPage)).toContain('admin')
    expect(roleComparisons(sessionPage)).toContain('admin')
  })

  it('checks no role name the auth mapping cannot produce', () => {
    // `supervisor` is not in `AuthRole`, so a gate on it is unreachable.
    expect(indexPage).not.toMatch(/userRole\s*===\s*'supervisor'/)
    expect(sessionPage).not.toMatch(/userRole\s*===\s*'supervisor'/)
  })

  it('leaves the auth role mapping untouched', () => {
    // The pages consume the session's role; they do not map or rewrite it.
    for (const source of [indexPage, sessionPage]) {
      expect(source).not.toMatch(/extractRoleFromPayload|app_metadata/)
    }
  })
})

describe('faculty review stays blocked', () => {
  it('renders an explicit blocker instead of an empty supervisor container', () => {
    expect(sessionPage).toMatch(/\{isSupervisor && \(/)
    expect(sessionPage).toContain('Faculty review is not available')
    // The blocker names the missing relation, not a substitute scoping rule.
    expect(sessionPage).toMatch(/not linked to a workspace/)
    // An empty container is a dead surface: nothing ever populates it.
    expect(sessionPage).not.toContain('id="supervisor-dashboard"')
  })

  it('renders the blocker only inside the faculty branch', () => {
    const facultyBranchStart = sessionPage.indexOf('{isSupervisor && (')
    const blockerStart = sessionPage.indexOf('Faculty review is not available')
    const traineeBranchStart = sessionPage.indexOf('{isTrainee && (')

    expect(facultyBranchStart).toBeGreaterThan(-1)
    expect(blockerStart).toBeGreaterThan(facultyBranchStart)
    expect(traineeBranchStart).toBeGreaterThan(-1)
    expect(traineeBranchStart).not.toBe(blockerStart)
  })
})

describe('dead supervisor handler', () => {
  it('no longer defines the handler that calls an undefined method', () => {
    expect(trainingScript).not.toMatch(/handleSupervisorIntervention/)
  })

  it('no longer calls the undefined `showSupervisorMessage`', () => {
    expect(trainingScript).not.toMatch(/showSupervisorMessage/)
  })
})

describe('dead session-update handler', () => {
  // The same class of defect as the supervisor handler: a handler the script
  // never calls, whose body calls a method the script never defines. `this.`
  // is matched too, because a call site without it (a bare `updateSessionState`)
  // would still be an undefined function at runtime.
  it('no longer defines `handleSessionUpdate`', () => {
    expect(trainingScript).not.toMatch(/handleSessionUpdate/)
  })

  it('no longer calls the undefined `updateSessionState`', () => {
    expect(trainingScript).not.toMatch(/\bupdateSessionState\b/)
  })

  it('keeps the handlers that only call defined methods', () => {
    // Removing the dead handler must not take its live neighbours with it.
    for (const handler of [
      'handleClientResponse',
      'handleCrisisAlert',
      'handleFeedbackUpdate',
    ]) {
      expect(trainingScript).toContain(`${handler}(data) {`)
    }
  })
})
