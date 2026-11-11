import type { APIContext } from 'astro'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getSession } from '../../../../lib/auth/session'
import { GET, POST } from '../analytics'

const state = vi.hoisted(() => ({
  writes: [] as unknown[][],
  query: vi.fn(),
  release: vi.fn(),
}))
vi.mock('../../../../lib/auth/session', () => ({ getSession: vi.fn() }))
vi.mock('../../../../lib/auth/internal-identity', () => ({
  resolveInternalUserId: async (principal: { id?: string } | null) =>
    principal?.id ?? null,
}))
vi.mock('../../../../lib/db', () => ({
  // The route must acquire through acquireClient(); mocking getPool() instead
  // would let a reverted direct borrow pass this suite unnoticed.
  acquireClient: async () => state,
}))
vi.mock('pg', () => ({
  Pool: class {
    async connect() {
      return state
    }
  },
}))

/**
 * `sessions.id` is a uuid column and the route now validates the shape before
 * any statement runs, so a fixture whose id must pass the guard has to be a
 * real UUID. The sentinel strings this suite used (`own`, `foreign`) are kept
 * only in the malformed-identifier group at the bottom, where they assert the
 * new `410` expectation.
 */
const OWN_SESSION_ID = '7a62430b-a01a-4eaf-8eb8-517e70ffb20d'
const FOREIGN_SESSION_ID = '3b9f2e18-5c47-4a0d-8f6e-91d2c4b7a830'

const context = (
  method: string,
  sessionId: string,
  body?: unknown,
): APIContext =>
  ({
    request: new Request(
      `http://localhost/api/session/analytics?sessionId=${sessionId}&therapistId=victim`,
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

const payload = (sessionId: string) => ({
  sessionId,
  analyticsData: {
    sessionMetrics: [{ metricName: 'duration', metricValue: 42 }],
    skillProgress: [],
  },
})
beforeEach(() => {
  login()
  state.writes = []
  state.query.mockImplementation(
    async (sql: string, values: unknown[] = []) => {
      if (sql.includes('FROM sessions')) {
        const owner = values[0] === OWN_SESSION_ID ? 'owner' : 'victim'
        const scoped = /therapist_id\s*=/.test(sql)
        const rows =
          scoped && values[1] !== owner ? [] : [{ therapist_id: owner }]
        return { rows, rowCount: rows.length }
      }
      if (sql.includes('INSERT INTO session_analytics')) {
        state.writes.push(values)
        return { rows: [], rowCount: 1 }
      }
      return {
        rows: [
          {
            metric_name: 'duration',
            metric_value: 42,
            metric_category: 'session',
            recorded_at: '2026-01-01T00:00:00Z',
            metadata: {},
          },
        ],
        rowCount: 1,
      }
    },
  )
})
describe('analytics owner boundary', () => {
  it.each(['GET', 'POST'])('rejects unauthenticated %s', async (method) => {
    vi.mocked(getSession).mockResolvedValue(null)
    const response = await (method === 'GET'
      ? GET(context(method, OWN_SESSION_ID))
      : POST(context(method, OWN_SESSION_ID, payload(OWN_SESSION_ID))))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Authentication required' })
    expect(state.writes).toEqual([])
  })
  it.each(
    ['therapist', 'admin', 'supervisor'].flatMap((role) =>
      ['GET', 'POST'].map((method) => [role, method]),
    ),
  )('denies foreign %s %s', async (role, method) => {
    login(role)
    const response = await (method === 'GET'
      ? GET(context(method, FOREIGN_SESSION_ID))
      : POST(context(method, FOREIGN_SESSION_ID, payload(FOREIGN_SESSION_ID))))
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Session not found' })
    expect(state.writes).toEqual([])
  })
  it('preserves own analytics read/write contract', async () => {
    const saved = await POST(
      context('POST', OWN_SESSION_ID, payload(OWN_SESSION_ID)),
    )
    expect(saved.status).toBe(200)
    expect(await saved.json()).toEqual({
      success: true,
      sessionId: OWN_SESSION_ID,
    })
    expect(state.writes).toHaveLength(1)
    expect(state.writes[0].slice(0, 3)).toEqual([
      OWN_SESSION_ID,
      'duration',
      42,
    ])
    const response = await GET(context('GET', OWN_SESSION_ID))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      sessionId: OWN_SESSION_ID,
      analyticsData: {
        sessionMetrics: [{ metricName: 'duration', metricValue: 42 }],
        skillProgress: [],
      },
    })
  })
})

describe('analytics malformed identifier', () => {
  /**
   * `sessions.id` is a uuid column, so an unvalidated identifier reached the
   * ownership SELECT and PostgreSQL raised `22P02`, which the catch-all
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

  it('answers 410 for a non-UUID sessionId on POST', async () => {
    const response = await POST(
      context('POST', MALFORMED_SESSION_ID, payload(MALFORMED_SESSION_ID)),
    )

    await expectExcluded(response)
  })

  it('answers 410 for a non-UUID sessionId on GET', async () => {
    const response = await GET(context('GET', MALFORMED_SESSION_ID))

    await expectExcluded(response)
  })

  it('answers 410 for a malformed id even when analyticsData is invalid', async () => {
    // The route is excluded regardless of body shape, so the identifier is
    // classified before the payload shape is judged.
    const response = await POST(
      context('POST', MALFORMED_SESSION_ID, {
        sessionId: MALFORMED_SESSION_ID,
      }),
    )

    await expectExcluded(response)
  })
})
