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
vi.mock('../../../../lib/db', () => ({
  getPool: () => ({ connect: async () => state }),
}))
vi.mock('pg', () => ({
  Pool: class {
    async connect() {
      return state
    }
  },
}))

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
        const owner = values[0] === 'own' ? 'owner' : 'victim'
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
      ? GET(context(method, 'own'))
      : POST(context(method, 'own', payload('own'))))
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
      ? GET(context(method, 'foreign'))
      : POST(context(method, 'foreign', payload('foreign'))))
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Session not found' })
    expect(state.writes).toEqual([])
  })
  it('preserves own analytics read/write contract', async () => {
    const saved = await POST(context('POST', 'own', payload('own')))
    expect(saved.status).toBe(200)
    expect(await saved.json()).toEqual({ success: true, sessionId: 'own' })
    expect(state.writes).toHaveLength(1)
    expect(state.writes[0].slice(0, 3)).toEqual(['own', 'duration', 42])
    const response = await GET(context('GET', 'own'))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      sessionId: 'own',
      analyticsData: {
        sessionMetrics: [{ metricName: 'duration', metricValue: 42 }],
        skillProgress: [],
      },
    })
  })
})
