/** @vitest-environment node */

/**
 * Session creation and the scenario catalog are structure, and the content is
 * deliberately absent (VAL-SCAF-001, VAL-SCAF-002).
 *
 * The 2026-11-11 grant allows these two journey surfaces to be built as real
 * routes with real data access, and forbids authoring the content they depend
 * on: no scenario name, vignette, difficulty taxonomy, or learning objective.
 * There is no approved catalog, so every content-dependent element must render
 * an explicit not-yet-approved state naming the owner.
 *
 * The repository already carries an authored clinical scenario list
 * (`src/data/scenarios.ts`) that the simulator consumes. It is not an approval,
 * and the scaffold must not present it as one, so this suite also asserts that
 * none of its entries leak into the new surfaces.
 *
 * Astro pages have no component test runner in this repository (see
 * `trainee-error-surface.test.ts`), so the page half is a structural guard over
 * the page sources. The data seam and the creation decision are pure functions
 * and are exercised directly.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  SCENARIO_CATALOG_BLOCKER,
  SCENARIO_NOT_SELECTED_BLOCKER,
  SCENARIO_SESSION_TEMPLATE_BLOCKER,
} from '../_scaffold-blockers'
import { loadApprovedScenarioCatalog } from '../_scenario-catalog'
import {
  planTrainingSessionCreation,
  readSubmittedScenarioId,
} from '../_session-creation'

const readFile = (relativePath: string): string =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')

const catalogPage = readFile('../scenarios/index.astro')
const creationPage = readFile('../sessions/new.astro')
const indexPage = readFile('../index.astro')
const sessionPage = readFile('../session/[sessionId].astro')

const catalogModule = readFile('../_scenario-catalog.ts')
const creationModule = readFile('../_session-creation.ts')
const blockerModule = readFile('../_scaffold-blockers.ts')
const catalogSource = readFile('../_scenario-catalog.source.json')

/** An owner-approved catalog, used only to exercise the approved branch. */
const approvedFixture = {
  approval: {
    approvedBy: 'Fixture approver',
    approvedAt: '2026-01-01T00:00:00.000Z',
  },
  scenarios: [{ id: 'fixture-scenario', label: 'Fixture label' }],
}

const chromaticChrome =
  /\b(?:bg|text|border|ring)-(?:emerald|indigo|red|green|blue|amber|purple|slate|gray|neutral|teal|pink|rose|cyan|yellow|orange)-/

const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u

describe('the approved scenario catalog does not exist', () => {
  it('loads the shipped artefact as an explicit not-approved state', () => {
    const snapshot = loadApprovedScenarioCatalog()

    expect(snapshot.status).toBe('not-approved')
    expect(snapshot.scenarios).toEqual([])
    expect(snapshot).toMatchObject({ blocker: SCENARIO_CATALOG_BLOCKER })
  })

  it('names the approval and the owner in the blocker', () => {
    expect(SCENARIO_CATALOG_BLOCKER.headline).toMatch(
      /awaiting the approved scenario catalog/i,
    )
    expect(SCENARIO_CATALOG_BLOCKER.owner).toMatch(/clinical content owner/i)
    expect(SCENARIO_CATALOG_BLOCKER.detail).toMatch(
      /no approved scenario catalog/i,
    )
  })

  it('ships an artefact with no entries and no approval record', () => {
    const parsed = JSON.parse(catalogSource) as {
      approval: unknown
      scenarios: unknown
    }

    expect(parsed.approval).toBeNull()
    expect(parsed.scenarios).toEqual([])
  })

  it('authors no clinical vocabulary in the artefact', () => {
    // The absence is recorded; the content it would hold is not.
    for (const key of [
      'vignette',
      'difficulty',
      'learningObjectives',
      'persona',
      'systemMessage',
      'clientProfile',
    ]) {
      expect(catalogSource).not.toMatch(new RegExp(`"${key}"`))
    }
  })
})

describe('the catalog loader fails closed', () => {
  it('refuses a source that is not an object', () => {
    expect(loadApprovedScenarioCatalog(null).status).toBe('not-approved')
    expect(loadApprovedScenarioCatalog([]).status).toBe('not-approved')
    expect(loadApprovedScenarioCatalog('approved').status).toBe('not-approved')
  })

  it('refuses an approval with no approver', () => {
    const snapshot = loadApprovedScenarioCatalog({
      approval: { approvedBy: '', approvedAt: '2026-01-01T00:00:00.000Z' },
      scenarios: [],
    })

    expect(snapshot.status).toBe('not-approved')
  })

  it('refuses an approval with an unparseable date', () => {
    const snapshot = loadApprovedScenarioCatalog({
      approval: { approvedBy: 'Fixture approver', approvedAt: 'not-a-date' },
      scenarios: [],
    })

    expect(snapshot.status).toBe('not-approved')
  })

  it('refuses a malformed entry rather than rendering a partial catalog', () => {
    const snapshot = loadApprovedScenarioCatalog({
      approval: approvedFixture.approval,
      scenarios: [{ id: 'fixture-scenario' }],
    })

    expect(snapshot.status).toBe('not-approved')
    expect(snapshot.scenarios).toEqual([])
  })

  it('accepts an approved catalog with well-formed entries', () => {
    const snapshot = loadApprovedScenarioCatalog(approvedFixture)

    expect(snapshot.status).toBe('approved')
    expect(snapshot.scenarios).toEqual([
      { id: 'fixture-scenario', label: 'Fixture label' },
    ])
  })
})

describe('session creation stops at named blockers', () => {
  it('cannot create a session while the catalog is unapproved', () => {
    const plan = planTrainingSessionCreation(
      loadApprovedScenarioCatalog(),
      null,
    )

    expect(plan.scenario).toBeNull()
    expect(plan.blockers).toEqual([
      SCENARIO_CATALOG_BLOCKER,
      SCENARIO_SESSION_TEMPLATE_BLOCKER,
    ])
    expect(plan.blockers).not.toHaveLength(0)
  })

  it('asks for an approved selection once the catalog is approved', () => {
    const catalog = loadApprovedScenarioCatalog(approvedFixture)

    for (const scenarioId of [null, 'not-in-the-catalog']) {
      const plan = planTrainingSessionCreation(catalog, scenarioId)

      expect(plan.scenario).toBeNull()
      expect(plan.blockers).toEqual([
        SCENARIO_NOT_SELECTED_BLOCKER,
        SCENARIO_SESSION_TEMPLATE_BLOCKER,
      ])
    }
  })

  it('keeps the scenario-to-session decision as the last blocker', () => {
    const catalog = loadApprovedScenarioCatalog(approvedFixture)
    const plan = planTrainingSessionCreation(catalog, 'fixture-scenario')

    expect(plan.scenario).toEqual({
      id: 'fixture-scenario',
      label: 'Fixture label',
    })
    // An approved scenario is not yet a session: the mapping is still the
    // product owner's decision, so the plan never clears.
    expect(plan.blockers).toEqual([SCENARIO_SESSION_TEMPLATE_BLOCKER])
    expect(SCENARIO_SESSION_TEMPLATE_BLOCKER.owner).toMatch(/product owner/i)
  })

  it('performs no write', () => {
    // The creation path is the decision in front of the write, not the write.
    expect(creationModule).not.toMatch(/\bINSERT\b/i)
    expect(creationModule).not.toMatch(/\bUPDATE\b/i)
    expect(creationModule).not.toMatch(/\bDELETE\b/i)
    expect(creationModule).not.toMatch(/@\/lib\/db/)
  })

  it('treats an unparseable submission as no selection, not a failure', async () => {
    const valid = new Request('http://localhost/training/sessions/new', {
      method: 'POST',
      body: new URLSearchParams({ scenario: 'fixture-scenario' }),
    })
    expect(await readSubmittedScenarioId(valid)).toBe('fixture-scenario')

    const missing = new Request('http://localhost/training/sessions/new', {
      method: 'POST',
      body: new URLSearchParams({}),
    })
    expect(await readSubmittedScenarioId(missing)).toBeNull()

    const malformed = new Request('http://localhost/training/sessions/new', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data' },
      body: 'not-a-form',
    })
    expect(await readSubmittedScenarioId(malformed)).toBeNull()
  })
})

describe('the scenario catalog surface', () => {
  it('renders the loader state instead of a hardcoded list', () => {
    expect(catalogPage).toMatch(/loadApprovedScenarioCatalog\(\)/)
    expect(catalogPage).toMatch(/catalog\.blocker\.headline/)
    expect(catalogPage).toMatch(/catalog\.blocker\.owner/)
    expect(catalogPage).toMatch(/No approved scenarios are listed/)
  })

  it('renders rows only from an approved catalog', () => {
    expect(catalogPage).toMatch(/catalog\.scenarios\.map\(/)
    expect(catalogPage).toMatch(/scenario\.label/)
    expect(catalogPage).toMatch(/\/training\/sessions\/new\?scenario=/)
  })

  it('resolves the page session once, through the shared helper', () => {
    const helperCalls = catalogPage.match(/resolvePageSession\s*\(/g) ?? []

    expect(helperCalls).toHaveLength(1)
    expect(catalogPage).toMatch(
      /resolvePageSession\(\s*Astro\.request,\s*Astro\.locals,?\s*\)/,
    )
    expect(catalogPage).not.toMatch(/\bgetSession\s*\(/)
    expect(catalogPage).not.toMatch(/\bisAuthenticated\s*\(/)
    expect(catalogPage).not.toMatch(/\bgetCurrentUser\s*\(/)
  })

  it('answers a provider outage with a retryable response, not a logout', () => {
    expect(catalogPage).toMatch(
      /providerUnavailableResponse\(Astro\.url\.pathname\)/,
    )
    expect(catalogPage).toMatch(/\/login\?redirect=/)
  })

  it('keeps the design system', () => {
    expect(catalogPage).not.toMatch(chromaticChrome)
    expect(catalogPage).not.toMatch(/\brounded-(?!none)/)
    expect(catalogPage).not.toMatch(/\bshadow-/)
    expect(catalogPage).not.toMatch(emoji)
    expect(catalogPage).toContain('min-h-[44px]')
  })
})

describe('the session creation surface', () => {
  it('renders every blocker the creation path returned', () => {
    expect(creationPage).toMatch(/loadApprovedScenarioCatalog\(\)/)
    expect(creationPage).toMatch(/plan\.blockers\.map\(/)
    expect(creationPage).toMatch(/blocker\.headline/)
    expect(creationPage).toMatch(/blocker\.owner/)
  })

  it('posts to the creation path and reports its refusal', () => {
    expect(creationPage).toMatch(/method="post"/)
    expect(creationPage).toMatch(/readSubmittedScenarioId\(Astro\.request\)/)
    expect(creationPage).toMatch(/No training session was created/)
    expect(creationPage).toMatch(/Astro\.response\.status\s*=\s*409/)
  })

  it('never presents a working control while creation is blocked', () => {
    // `canCreate` is false for every state the shipped artefact can produce.
    expect(creationPage).toMatch(
      /const canCreate = plan\.blockers\.length === 0/,
    )
    expect(creationPage).toMatch(/disabled=\{!canCreate\}/)
  })

  it('resolves the page session once, through the shared helper', () => {
    const helperCalls = creationPage.match(/resolvePageSession\s*\(/g) ?? []

    expect(helperCalls).toHaveLength(1)
    expect(creationPage).toMatch(
      /resolvePageSession\(\s*Astro\.request,\s*Astro\.locals,?\s*\)/,
    )
    expect(creationPage).not.toMatch(/\bgetSession\s*\(/)
    expect(creationPage).not.toMatch(/\bisAuthenticated\s*\(/)
    expect(creationPage).not.toMatch(/\bgetCurrentUser\s*\(/)
  })

  it('keeps the design system', () => {
    expect(creationPage).not.toMatch(chromaticChrome)
    expect(creationPage).not.toMatch(/\brounded-(?!none)/)
    expect(creationPage).not.toMatch(/\bshadow-/)
    expect(creationPage).not.toMatch(emoji)
    expect(creationPage).toContain('min-h-[44px]')
  })
})

describe('the surfaces are reachable through normal navigation', () => {
  it('links both surfaces from the training portal', () => {
    expect(indexPage).toContain('href="/training/scenarios"')
    expect(indexPage).toContain('href="/training/sessions/new"')
    expect(indexPage).toMatch(/Awaiting the approved\s+scenario catalog/)
  })

  it('links back to the portal from both surfaces', () => {
    expect(catalogPage).toContain('href="/training"')
    expect(creationPage).toContain('href="/training"')
    expect(creationPage).toContain('href="/training/scenarios"')
  })
})

describe('no clinical content is authored', () => {
  it('does not consume the unapproved authored scenario list', () => {
    // Naming the file to explain why it is *not* read is fine; importing it is
    // what would present unapproved clinical content as the catalog.
    for (const source of [
      catalogPage,
      creationPage,
      catalogModule,
      creationModule,
      blockerModule,
    ]) {
      expect(source).not.toMatch(/from\s+['"][^'"]*data\/scenarios['"]/)
      expect(source).not.toMatch(/\bclientScenarios\b/)
    }
  })

  it('does not reproduce any authored scenario name', () => {
    const authoredScenarios = readFile('../../../data/scenarios.ts')
    const names = [...authoredScenarios.matchAll(/name:\s*'([^']+)'/g)].map(
      (match) => match[1],
    )

    expect(names.length).toBeGreaterThan(0)

    const scaffoldSources = [
      catalogPage,
      creationPage,
      indexPage,
      catalogModule,
      creationModule,
      blockerModule,
      catalogSource,
    ].join('\n')

    for (const name of names) {
      expect(scaffoldSources).not.toContain(name)
    }
  })
})

describe('the shipped VAL-UX-003 comment names the right element', () => {
  it('attributes the clip to the left aside and the Retry button', () => {
    const comment =
      sessionPage.match(
        /\/\* Each trainee aside is its own scroll container[\s\S]*?\*\//,
      )?.[0] ?? ''

    expect(comment).not.toBe('')
    expect(comment).toMatch(/\*\*left\*\*/)
    expect(comment).toMatch(/Retry/)
    // `#session-notes` lives in the right aside and fits; the comment says so
    // rather than blaming it for the clipped control.
    expect(comment).toMatch(/right aside and fits/)
    expect(comment).not.toMatch(/#session-notes` textarea sits/)
  })
})
