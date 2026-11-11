import type { APIContext } from 'astro'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getSession } from '../../../lib/auth/session'
import { GET, POST } from '../../../pages/api/session/comparison'

const state = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgres://test:test@localhost/test'
  return {
    writes: [] as unknown[][],
    query: vi.fn(),
    release: vi.fn(),
  }
})
vi.mock('../../../lib/auth/session', () => ({ getSession: vi.fn() }))
vi.mock('../../../lib/auth/internal-identity', () => ({
  resolveInternalUserId: async (principal: { id?: string } | null) =>
    principal?.id ?? null,
}))
vi.mock('../../../lib/db', () => ({
  acquireClient: async () => state,
}))

/**
 * `sessions.id` is a uuid column and the route now validates the shape before
 * any statement runs, so a fixture whose id must pass the guard has to be a
 * real UUID. The sentinel strings this suite used (`own`, `previous`,
 * `foreign`) are kept only in the malformed-identifier group at the bottom,
 * where they assert the new `410` expectation.
 */
const OWN_SESSION_ID = '7a62430b-a01a-4eaf-8eb8-517e70ffb20d'
const PREVIOUS_SESSION_ID = 'f1c0d0d4-6f0a-4e2c-9c56-2d5b1a0e7c11'
const FOREIGN_SESSION_ID = '3b9f2e18-5c47-4a0d-8f6e-91d2c4b7a830'
const OWNED_SESSION_IDS = [OWN_SESSION_ID, PREVIOUS_SESSION_ID]

const context = (
  method: string,
  sessionId: string,
  body?: unknown,
): APIContext =>
  ({
    request: new Request(
      `http://localhost/api/session/comparison?sessionId=${sessionId}&therapistId=victim`,
      {
        method,
        ...(body === undefined
          ? {}
          : {
              body: JSON.stringify(body),
              headers: { 'Content-Type': 'application/json' },
            }),
      },
    ),
  }) as APIContext

const login = (role = 'therapist') =>
  vi
    .mocked(getSession)
    .mockResolvedValue({ user: { id: 'owner', role } } as Awaited<
      ReturnType<typeof getSession>
    >)

const payload = (
  currentSessionId = OWN_SESSION_ID,
  previousSessionId: string | undefined = PREVIOUS_SESSION_ID,
) => ({
  therapistId: 'victim',
  currentSessionId,
  previousSessionId,
  improvementScore: 5,
  metrics: { empathy: 80 },
})
beforeEach(() => {
  login()
  state.writes = []
  state.query.mockImplementation(
    async (sql: string, values: unknown[] = []) => {
      if (sql.includes('INSERT INTO session_comparisons')) {
        state.writes.push(values)
        return { rows: [{ id: 'saved' }], rowCount: 1 }
      }
      if (sql.includes('FROM sessions')) {
        const owner = OWNED_SESSION_IDS.includes(String(values[0]))
          ? 'owner'
          : 'victim'
        const scoped = /therapist_id\s*=/.test(sql)
        const rows =
          !scoped || values[1] === owner
            ? [{ id: values[0], therapist_id: owner }]
            : []
        return { rows, rowCount: rows.length }
      }
      const scoped = /sc.therapist_id\s*=/.test(sql) && values.includes('owner')
      const rows =
        scoped && values[0] === FOREIGN_SESSION_ID
          ? []
          : [
              {
                id: 'comparison',
                therapist_id: scoped ? 'owner' : 'victim',
                current_session_id: scoped
                  ? OWN_SESSION_ID
                  : FOREIGN_SESSION_ID,
                improvement_score: 5,
                comparison_metrics: {},
              },
            ]
      return { rows, rowCount: rows.length }
    },
  )
})
describe('comparison owner boundary', () => {
  it.each([null, [], 'invalid', 42, true].map((body) => ({ body })))(
    'rejects non-object JSON payload $body',
    async ({ body }) => {
      const response = await POST(context('POST', OWN_SESSION_ID, body))
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'Invalid payload' })
      expect(state.writes).toEqual([])
    },
  )

  it.each(['GET', 'POST'])('rejects unauthenticated %s', async (method) => {
    vi.mocked(getSession).mockResolvedValue(null)
    const response = await (method === 'GET'
      ? GET(context(method, OWN_SESSION_ID))
      : POST(context(method, OWN_SESSION_ID, payload())))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Authentication required' })
    expect(state.writes).toEqual([])
  })
  it.each([
    [FOREIGN_SESSION_ID, PREVIOUS_SESSION_ID],
    [OWN_SESSION_ID, FOREIGN_SESSION_ID],
  ])(
    'denies foreign current/previous session %s %s',
    async (current, previous) => {
      const response = await POST(
        context('POST', current, payload(current, previous)),
      )
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: 'Session not found' })
      expect(state.writes).toEqual([])
    },
  )
  it.each([PREVIOUS_SESSION_ID, undefined])(
    'saves own comparison with optional previous %s',
    async (previous) => {
      const body = { ...payload(), previousSessionId: previous }
      const response = await POST(context('POST', OWN_SESSION_ID, body))
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        success: true,
        comparisonId: 'saved',
        therapistId: 'owner',
        currentSessionId: OWN_SESSION_ID,
      })
      expect(state.writes).toEqual([
        [
          'owner',
          OWN_SESSION_ID,
          previous ?? null,
          5,
          JSON.stringify(body.metrics),
        ],
      ])
    },
  )
  it('does not expose foreign comparisons by session ID', async () => {
    const response = await GET(context('GET', FOREIGN_SESSION_ID))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      therapistId: 'owner',
      comparisons: [],
    })
  })
  it.each([OWN_SESSION_ID, ''])(
    'filters GET by authenticated owner with spoofed therapistId (%s)',
    async (id) => {
      const response = await GET(context('GET', id))
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        therapistId: 'owner',
        comparisons: [
          {
            therapistId: 'owner',
            currentSessionId: OWN_SESSION_ID,
            trend: 'improving',
          },
        ],
      })
    },
  )
})

describe('comparison malformed identifier', () => {
  /**
   * `sessions.id` is a uuid column, so an unvalidated identifier reached the
   * ownership statement and PostgreSQL raised `22P02`, which the catch-all
   * answered as `500`. The route is excluded from the pilot surface regardless
   * of body shape, so the malformed identifier takes the existing `410` path.
   */
  const MALFORMED_SESSION_ID = 'not-a-uuid'

  const expectExcluded = async (response: Response) => {
    expect(response.status).toBe(410)
    expect(response.headers.get('Retry-After')).toBeNull()
    expect(await response.json()).toMatchObject({
      code: 'LEGACY_SESSION_API_UNAVAILABLE',
    })
    expect(state.writes).toEqual([])
  }

  it('answers 410 for a non-UUID currentSessionId on POST', async () => {
    const response = await POST(
      context(
        'POST',
        MALFORMED_SESSION_ID,
        payload(MALFORMED_SESSION_ID, PREVIOUS_SESSION_ID),
      ),
    )

    await expectExcluded(response)
  })

  it('answers 410 for a non-UUID previousSessionId on POST', async () => {
    const response = await POST(
      context(
        'POST',
        OWN_SESSION_ID,
        payload(OWN_SESSION_ID, MALFORMED_SESSION_ID),
      ),
    )

    await expectExcluded(response)
  })

  it('answers 410 for a non-UUID sessionId on GET', async () => {
    const response = await GET(context('GET', MALFORMED_SESSION_ID))

    await expectExcluded(response)
  })

  it('answers 410 for a malformed id even when the rest of the body is invalid', async () => {
    // The route is excluded regardless of body shape, so the identifier is
    // classified before the required-field check rather than after it.
    const response = await POST(
      context('POST', MALFORMED_SESSION_ID, {
        currentSessionId: MALFORMED_SESSION_ID,
      }),
    )

    await expectExcluded(response)
  })
})
