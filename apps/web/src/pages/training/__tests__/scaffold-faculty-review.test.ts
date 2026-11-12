/** @vitest-environment node */

/**
 * Faculty review exists as structure and stops at the boundary of the missing
 * relation (VAL-SCAF-001).
 *
 * Faculty review means "a faculty member reviews a trainee's training session".
 * Answering it needs a workspace scope — a faculty member belongs to an
 * organization, not to the sessions they review — and `sessions` has no
 * `workspace_id`. So the surface renders the blocker and the access path, and
 * reads no session at all.
 *
 * The assertions that matter most are the negative ones. A working-looking
 * faculty surface built on a substitute scope would be a tenant-boundary defect
 * of exactly the kind this mission exists to prevent, so this suite proves:
 *
 *  - the seam never calls the workspace-scoped query (there is no column);
 *  - the seam has no `ready`/list variant, so no branch can return sessions;
 *  - the surface sources contain no therapist-id join, no client-side filter,
 *    and no broad session read;
 *  - no migration was written (the proposed one is named, not created).
 *
 * Astro pages have no component test runner in this repository (see
 * `trainee-error-surface.test.ts`), so the page half is a structural guard over
 * the page sources. The panel is the exception: it imports no stylesheet, so
 * Astro's container renders it and the test asserts the blocker in rendered
 * text. The seam is a pure function exercised directly.
 *
 * VAL-SCAF-001 covers five scaffolds. Two of them — the scenario catalog with
 * session creation, and the synthetic-client reply with coaching surfaces — live
 * on their own unmerged PR branches (#6761, #6762) and are not in this tree. The
 * table below therefore checks the scaffolds that are present and treats an
 * absent route as the permitted "absent from the surface" state; the rendered
 * and navigation proof for all five belongs to
 * `journey-scaffolding-release-and-verify`.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { describe, expect, it, vi } from 'vitest'

import {
  CLOSING_MIGRATION,
  CLOSING_MIGRATION_DETAIL,
  FACULTY_REVIEW_BLOCKERS,
  FACULTY_REVIEW_ROLE,
  refuseUnscopedSessionQuery,
  resolveFacultyReviewScope,
} from '../_faculty-review'
import FacultyReviewPanel from '../_FacultyReviewPanel.astro'

const readFile = (relativePath: string): string =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')

const moduleSource = readFile('../_faculty-review.ts')
const panelComponent = readFile('../_FacultyReviewPanel.astro')
const reviewPage = readFile('../faculty-review/index.astro')
const sessionPage = readFile('../session/[sessionId].astro')
const indexPage = readFile('../index.astro')

/** The three files the faculty-review surface is made of. */
const facultyReviewSources = [
  ['_faculty-review.ts', moduleSource],
  ['_FacultyReviewPanel.astro', panelComponent],
  ['faculty-review/index.astro', reviewPage],
] as const

/**
 * The same sources with comments removed.
 *
 * The negative scans below must read code, not prose: the module's docstring
 * names the therapist-id join and the session read path precisely in order to
 * say it does not use them, and a scan that cannot tell a comment from a call
 * would punish the explanation.
 */
const stripComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/[^\n]*/g, '$1')
    .replace(/<!--[\s\S]*?-->/g, '')

const facultyReviewCode = facultyReviewSources.map(
  ([name, source]) => [name, stripComments(source)] as const,
)

/** Which of the surface's files match a pattern; empty means none do. */
const filesMatching = (pattern: RegExp): string[] =>
  facultyReviewCode
    .filter(([, source]) => pattern.test(source))
    .map(([name]) => name)

const blockerById = (id: string) =>
  FACULTY_REVIEW_BLOCKERS.find((blocker) => blocker.id === id)

describe('the access path resolves to nothing while the relation is missing', () => {
  it('returns the single blocked outcome for the faculty role', () => {
    const outcome = resolveFacultyReviewScope({
      role: FACULTY_REVIEW_ROLE,
      workspaceId: '00000000-0000-4000-8000-00000000000a',
      listSessionsInWorkspace: refuseUnscopedSessionQuery,
    })

    expect(outcome.status).toBe('blocked')
    expect(outcome.canReview).toBe(true)
    expect(outcome.blockers).toEqual(FACULTY_REVIEW_BLOCKERS)
    // No field carries sessions, because there is nothing to scope them by.
    expect(Object.keys(outcome).sort()).toEqual([
      'blockers',
      'canReview',
      'scopeWorkspaceId',
      'status',
    ])
  })

  it('never runs the workspace-scoped query', () => {
    // The query is the shape the surface will use once `sessions.workspace_id`
    // exists. Running it today would read a column that is not there, and the
    // only alternatives are unscoped reads — so it must not be reached at all.
    const listSessionsInWorkspace = vi.fn(async () => [])

    resolveFacultyReviewScope({
      role: FACULTY_REVIEW_ROLE,
      workspaceId: '00000000-0000-4000-8000-00000000000a',
      listSessionsInWorkspace,
    })

    expect(listSessionsInWorkspace).not.toHaveBeenCalled()
  })

  it('refuses to query unscoped if the dependency is ever reached', async () => {
    await expect(refuseUnscopedSessionQuery()).rejects.toThrow(
      /must not query sessions/,
    )
  })

  it('reports whether the caller carries the faculty role', () => {
    const scopeFor = (role: string) =>
      resolveFacultyReviewScope({
        role,
        workspaceId: null,
        listSessionsInWorkspace: refuseUnscopedSessionQuery,
      })

    expect(scopeFor('admin').canReview).toBe(true)
    // `supervisor` is the word a reader would expect, and it is not in the
    // `AuthRole` union, so a gate on it is unreachable. `mapToUserRole` also
    // collapses it to `guest`.
    for (const role of ['therapist', 'guest', 'user', 'staff', 'supervisor']) {
      expect(scopeFor(role).canReview).toBe(false)
    }
  })

  it('keeps the caller workspace as the scope once the relation exists', () => {
    const workspaceId = '00000000-0000-4000-8000-00000000000a'
    const outcome = resolveFacultyReviewScope({
      role: FACULTY_REVIEW_ROLE,
      workspaceId,
      listSessionsInWorkspace: refuseUnscopedSessionQuery,
    })

    expect(outcome.scopeWorkspaceId).toBe(workspaceId)
    expect(
      resolveFacultyReviewScope({
        role: FACULTY_REVIEW_ROLE,
        workspaceId: undefined,
        listSessionsInWorkspace: refuseUnscopedSessionQuery,
      }).scopeWorkspaceId,
    ).toBeNull()
  })

  it('has no outcome variant that can return sessions', () => {
    // The absence is structural: a session list has to be returned by this
    // module to reach a surface, and only `blocked` exists.
    expect(moduleSource).toMatch(/status: 'blocked'/)
    expect(moduleSource).not.toMatch(/status: 'ready'/)
    expect(moduleSource).not.toMatch(/readonly sessions\b/)
  })
})

describe('the blocker names the relation and the migration that would close it', () => {
  it('names the missing sessions-to-workspace relation', () => {
    const scope = blockerById(
      'faculty-review-sessions-workspace-relation-missing',
    )
    expect(scope).toBeDefined()
    expect(scope?.headline).toBe('Faculty review is not available')
    expect(scope?.owner).toBe('Platform data owner')
    expect(scope?.detail).toMatch(/not linked to a workspace/)
    expect(scope?.detail).toContain('`sessions`')
    expect(scope?.detail).toContain('`workspace_id`')
    // And it names the substitute scopes it will not use, so a later reader
    // cannot mistake the refusal for an oversight.
    expect(scope?.detail).toMatch(/therapist-id join/)
    expect(scope?.detail).toMatch(/client-side filter/)
    expect(scope?.detail).toMatch(/blanket view of every session/)
  })

  it('names the migration that would close it, without writing it', () => {
    expect(CLOSING_MIGRATION).toBe('018_add_workspace_id_to_sessions.sql')
    expect(CLOSING_MIGRATION_DETAIL).toContain('sessions.workspace_id')
    expect(CLOSING_MIGRATION_DETAIL).toContain('backfill')
    expect(CLOSING_MIGRATION_DETAIL).toMatch(/may not write it/)

    // The proposed migration is not on disk. No DDL, no migration.
    const migrationDir = fileURLToPath(
      new URL('../../../../../../db/migrations', import.meta.url),
    )
    expect(existsSync(migrationDir)).toBe(true)
    expect(
      readdirSync(migrationDir).filter((file) => /^018_/.test(file)),
    ).toEqual([])
  })

  it('names the three disjoint role vocabularies', () => {
    const role = blockerById('faculty-review-role-vocabulary-disjoint')
    expect(role?.owner).toBe('Identity owner')
    expect(role?.detail).toContain('`AuthRole`')
    expect(role?.detail).toContain('`UserRole`')
    expect(role?.detail).toContain('`mapToUserRole`')
    expect(role?.detail).toMatch(/supervisor/)
  })

  it('names the divergent session schema file', () => {
    const schema = blockerById('faculty-review-session-schema-divergent')
    expect(schema?.owner).toBe('Platform data owner')
    expect(schema?.detail).toContain('`db/session.sql`')
    expect(schema?.detail).toContain('training_session_messages')
  })

  it('names the duplicated migration number', () => {
    const migration = blockerById('faculty-review-migration-number-collision')
    expect(migration?.owner).toBe('Platform data owner')
    expect(migration?.detail).toContain('011_add_workspace_id_to_users.sql')
    expect(migration?.detail).toContain('011_create_audit_logs_table.sql')
    expect(migration?.detail).toMatch(/018/)
  })

  it('renders every blocker with its owner on the surface', () => {
    expect(reviewPage).toMatch(/outcome\.blockers\.map/)
    expect(reviewPage).toContain('{blocker.headline}')
    expect(reviewPage).toContain('{blocker.detail}')
    expect(reviewPage).toContain('{blocker.owner}')
    expect(reviewPage).toContain('{CLOSING_MIGRATION}')
    expect(reviewPage).toContain('{CLOSING_MIGRATION_DETAIL}')
  })
})

describe('no substitute scoping and no session read', () => {
  it('contains no therapist-id join anywhere on the surface', () => {
    expect(filesMatching(/therapist_id|therapistId/)).toEqual([])
  })

  it('reads no training session', () => {
    // `getTrainingSessionResponse` scopes by `therapist_id`, so using it here
    // would be the therapist-id join under another name.
    expect(filesMatching(/getTrainingSessionResponse/)).toEqual([])
    expect(filesMatching(/services\/training\/session-api/)).toEqual([])
    expect(filesMatching(/FROM\s+training_session_messages/i)).toEqual([])
  })

  it('filters nothing on the client', () => {
    expect(filesMatching(/\.filter\(/)).toEqual([])
    expect(filesMatching(/\.map\(.*sessions?/)).toEqual([])
  })

  it('queries no database directly', () => {
    expect(filesMatching(/from '@\/lib\/db/)).toEqual([])
    expect(filesMatching(/getPool|acquireClient/)).toEqual([])
  })
})

describe('the surface and its access path are real', () => {
  it('resolves the page session exactly once and adds no second validation', () => {
    expect(reviewPage.match(/resolvePageSession\(/g)).toHaveLength(1)
    for (const call of ['getSession(', 'isAuthenticated(', 'getCurrentUser(']) {
      expect(reviewPage).not.toContain(call)
    }
  })

  it('states the faculty role gate instead of hiding the surface', () => {
    expect(reviewPage).toContain('{FACULTY_REVIEW_ROLE}')
    expect(reviewPage).toMatch(/outcome\.canReview/)
  })

  it('carries the session reference into the access path without reading it', () => {
    expect(reviewPage).toContain("searchParams.get('sessionId')")
    expect(reviewPage).toMatch(/No session data is read/)
    expect(panelComponent).toMatch(/faculty-review\?sessionId=/)
  })

  it('is reachable from the training index through a delimited block', () => {
    expect(indexPage).toContain('href="/training/faculty-review"')
    const blockStart = indexPage.indexOf(
      'Journey scaffolding: faculty review (structure only)',
    )
    const blockEnd = indexPage.indexOf(
      '<!-- /Journey scaffolding: faculty review -->',
    )
    expect(blockStart).toBeGreaterThan(-1)
    expect(blockEnd).toBeGreaterThan(blockStart)
    expect(indexPage.slice(blockStart, blockEnd)).toContain(
      '/training/faculty-review',
    )
  })

  it('renders one panel inside the session page, in the faculty branch', () => {
    expect(sessionPage).toMatch(/\{isSupervisor &&[\s(]*<FacultyReviewPanel\b/)
    expect(sessionPage.match(/<FacultyReviewPanel\b/g)).toHaveLength(1)
    expect(sessionPage).not.toContain('id="supervisor-dashboard"')
  })
})

describe('the panel renders its blocker (VAL-SCAF-001 rendered text)', () => {
  // The container renders the component through the same Astro pipeline the
  // page uses, so this is rendered text, not a source scan. The route page
  // itself cannot be rendered here: it imports `Layout`, which imports the
  // UnoCSS reset stylesheet, and the test environment has no CSS loader.
  const render = async (sessionId: string): Promise<string> => {
    const container = await AstroContainer.create()
    return container.renderToString(FacultyReviewPanel, {
      props: { sessionId },
    })
  }

  it('renders the headline, the reason, and the closing migration', async () => {
    const html = await render('11111111-1111-4111-8111-111111111111')

    expect(html).toContain('Faculty review is not available')
    expect(html).toContain('not linked to a workspace')
    expect(html).toContain('therapist-id join')
    expect(html).toContain(CLOSING_MIGRATION)
    expect(html).toContain('This mission may not add DDL or a migration')
  })

  it('links only to the blocker surface, and presents no dead control', async () => {
    const sessionId = '11111111-1111-4111-8111-111111111111'
    const html = await render(sessionId)

    expect(html).toContain(`/training/faculty-review?sessionId=${sessionId}`)
    // Nothing on the panel pretends to review, approve, or submit anything.
    expect(html).not.toMatch(/<button/i)
    expect(html).not.toMatch(/<form/i)
    expect(html).not.toMatch(/<input/i)
    expect(html).not.toMatch(/<textarea/i)
  })
})

describe('no clinical content, scenario, or rubric is authored', () => {
  const scenarioSource = readFile('../../../../src/data/scenarios.ts')
  const scenarioNames = [...scenarioSource.matchAll(/name:\s*'([^']+)'/g)].map(
    (match) => match[1],
  )

  it('reads a real scenario list to test against', () => {
    expect(scenarioNames.length).toBeGreaterThan(0)
  })

  it('reproduces no authored scenario name', () => {
    const offenders = scenarioNames.filter((name) =>
      facultyReviewSources.some(([, source]) => source.includes(name)),
    )
    expect(offenders).toEqual([])
  })

  it('uses no clinical or coaching vocabulary', () => {
    expect(filesMatching(/vignette|persona|rubric|competenc/i)).toEqual([])
    expect(filesMatching(/Excellent|Good|Fair|Poor/)).toEqual([])
  })
})

describe('every journey scaffold present in this tree surfaces a blocker', () => {
  // VAL-SCAF-001: each scaffold renders its explicit not-yet-approved state, or
  // is absent from the surface entirely. The catalog and replies/coaching
  // routes live on unmerged sibling PRs, so they are absent here; the faculty
  // review route is this feature's and must always be present.
  const scaffolds = [
    {
      name: 'scenario catalog',
      path: '../scenarios/index.astro',
      required: false,
    },
    {
      name: 'session creation',
      path: '../sessions/new.astro',
      required: false,
    },
    { name: 'coaching', path: '../coaching/index.astro', required: false },
    {
      name: 'faculty review',
      path: '../faculty-review/index.astro',
      required: true,
    },
  ] as const

  for (const scaffold of scaffolds) {
    it(`${scaffold.name} renders a blocker or is absent`, () => {
      const filePath = fileURLToPath(new URL(scaffold.path, import.meta.url))
      const present = existsSync(filePath)

      if (!present) {
        // Absent is an allowed state. Only the faculty-review route is required.
        expect(scaffold.required).toBe(false)
        return
      }

      const source = readFileSync(filePath, 'utf8')
      expect(source).toMatch(/not[- ]approved|not available|awaiting/i)
    })
  }
})
