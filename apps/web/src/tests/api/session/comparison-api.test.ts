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
vi.mock('../../../lib/db', () => ({
  acquireClient: async () => state,
}))

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
  currentSessionId = 'own',
  previousSessionId: string | undefined = 'previous',
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
        const owner = ['own', 'previous'].includes(String(values[0]))
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
        scoped && values[0] === 'foreign'
          ? []
          : [
              {
                id: 'comparison',
                therapist_id: scoped ? 'owner' : 'victim',
                current_session_id: scoped ? 'own' : 'foreign',
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
      const response = await POST(context('POST', 'own', body))
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'Invalid payload' })
      expect(state.writes).toEqual([])
    },
  )

  it.each(['GET', 'POST'])('rejects unauthenticated %s', async (method) => {
    vi.mocked(getSession).mockResolvedValue(null)
    const response = await (method === 'GET'
      ? GET(context(method, 'own'))
      : POST(context(method, 'own', payload())))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Authentication required' })
    expect(state.writes).toEqual([])
  })
  it.each([
    ['foreign', 'previous'],
    ['own', 'foreign'],
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
  it.each(['previous', undefined])(
    'saves own comparison with optional previous %s',
    async (previous) => {
      const body = { ...payload(), previousSessionId: previous }
      const response = await POST(context('POST', 'own', body))
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        success: true,
        comparisonId: 'saved',
        therapistId: 'owner',
        currentSessionId: 'own',
      })
      expect(state.writes).toEqual([
        ['owner', 'own', previous ?? null, 5, JSON.stringify(body.metrics)],
      ])
    },
  )
  it('does not expose foreign comparisons by session ID', async () => {
    const response = await GET(context('GET', 'foreign'))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      therapistId: 'owner',
      comparisons: [],
    })
  })
  it.each(['own', ''])(
    'filters GET by authenticated owner with spoofed therapistId (%s)',
    async (id) => {
      const response = await GET(context('GET', id))
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        therapistId: 'owner',
        comparisons: [
          { therapistId: 'owner', currentSessionId: 'own', trend: 'improving' },
        ],
      })
    },
  )
})
