import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state, mockGetSession, mockResolveInternalUserId } = vi.hoisted(() => ({
  state: {
    query: vi.fn(),
    release: vi.fn(),
  },
  mockGetSession: vi.fn(),
  mockResolveInternalUserId: vi.fn(),
}))

vi.mock('../../../../lib/auth/session', () => ({ getSession: mockGetSession }))
vi.mock('../../../../lib/auth/internal-identity', () => ({
  resolveInternalUserId: mockResolveInternalUserId,
}))
vi.mock('../../../../lib/db', () => ({
  getPool: () => ({ connect: async () => state }),
  acquireClient: async () => state,
}))

import * as analytics from '../analytics'
import * as comparison from '../comparison'
import * as progress from '../progress'
import * as skills from '../skills'

const USER_UUID = '6cf52d73-8188-487f-a1c6-4ebc014328c0'
const SESSION_ID = '7a62430b-a01a-4eaf-8eb8-517e70ffb20d'

const LEGACY_SURFACE_CODE = 'LEGACY_SESSION_API_UNAVAILABLE'

type Handler = (context: never) => Promise<Response>

const invoke = (handler: Handler, request: Request) =>
  (handler as unknown as (value: object) => Promise<Response>)({ request })

const post = (path: string, body: unknown) =>
  new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const get = (path: string) => new Request(`http://localhost${path}`)

const schemaError = (code: string) =>
  Object.assign(new Error(`simulated schema error ${code}`), { code })

const ok = (rows: unknown[] = []) => ({ rowCount: rows.length, rows })

beforeEach(() => {
  vi.clearAllMocks()
  state.query.mockReset()
  state.release.mockReset()
  mockGetSession.mockResolvedValue({
    user: { id: 'auth0|legacy-caller', role: 'therapist' },
    expires: new Date(Date.now() + 60_000).toISOString(),
  })
  mockResolveInternalUserId.mockResolvedValue(USER_UUID)
})

describe('legacy /api/session/* routes on absent schema', () => {
  it('progress POST reports 410 instead of 500 when sessions.progress_metrics is absent', async () => {
    state.query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return ok()
      if (sql.includes('FOR UPDATE')) return ok([{ id: SESSION_ID }])
      throw schemaError('42703')
    })

    const response = await invoke(
      progress.POST as Handler,
      post('/api/session/progress', {
        sessionId: SESSION_ID,
        progressMetrics: { totalMessages: 1, progress: 50 },
      }),
    )

    expect(response.status).toBe(410)
    expect(await response.json()).toMatchObject({ code: LEGACY_SURFACE_CODE })
  })

  it('progress GET reports 410 instead of 500 when progress columns are absent', async () => {
    state.query.mockRejectedValue(schemaError('42703'))

    const response = await invoke(
      progress.GET as Handler,
      get(`/api/session/progress?sessionId=${SESSION_ID}`),
    )

    expect(response.status).toBe(410)
    expect(await response.json()).toMatchObject({ code: LEGACY_SURFACE_CODE })
  })

  it('skills POST reports 410 instead of 500 when sessions.skill_scores is absent', async () => {
    state.query.mockRejectedValue(schemaError('42703'))

    const response = await invoke(
      skills.POST as Handler,
      post('/api/session/skills', {
        sessionId: SESSION_ID,
        skillScores: { 'Active Listening': 80 },
      }),
    )

    expect(response.status).toBe(410)
    expect(await response.json()).toMatchObject({ code: LEGACY_SURFACE_CODE })
  })

  it('skills GET reports 410 instead of 500 when skill_development is absent', async () => {
    state.query.mockRejectedValue(schemaError('42P01'))

    const response = await invoke(
      skills.GET as Handler,
      get('/api/session/skills?therapistId=me'),
    )

    expect(response.status).toBe(410)
    expect(await response.json()).toMatchObject({ code: LEGACY_SURFACE_CODE })
  })

  it('comparison POST reports 410 instead of 500 when session_comparisons is absent', async () => {
    state.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM sessions')) return ok([{ id: SESSION_ID }])
      throw schemaError('42P01')
    })

    const response = await invoke(
      comparison.POST as Handler,
      post('/api/session/comparison', {
        currentSessionId: SESSION_ID,
        improvementScore: 10,
        metrics: { empathy: 1 },
      }),
    )

    expect(response.status).toBe(410)
    expect(await response.json()).toMatchObject({ code: LEGACY_SURFACE_CODE })
  })

  it('comparison GET reports 410 instead of 500 when session_comparisons is absent', async () => {
    state.query.mockRejectedValue(schemaError('42P01'))

    const response = await invoke(
      comparison.GET as Handler,
      get(`/api/session/comparison?sessionId=${SESSION_ID}`),
    )

    expect(response.status).toBe(410)
    expect(await response.json()).toMatchObject({ code: LEGACY_SURFACE_CODE })
  })

  it('analytics POST reports 410 instead of 500 when session_analytics is absent', async () => {
    state.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM sessions'))
        return ok([{ therapist_id: USER_UUID }])
      throw schemaError('42P01')
    })

    const response = await invoke(
      analytics.POST as Handler,
      post('/api/session/analytics', {
        sessionId: SESSION_ID,
        analyticsData: {
          sessionMetrics: [{ metricName: 'duration', metricValue: 42 }],
          skillProgress: [],
        },
      }),
    )

    expect(response.status).toBe(410)
    expect(await response.json()).toMatchObject({ code: LEGACY_SURFACE_CODE })
  })

  it('analytics GET reports 410 instead of 500 when session_analytics is absent', async () => {
    state.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM sessions'))
        return ok([{ therapist_id: USER_UUID }])
      throw schemaError('42P01')
    })

    const response = await invoke(
      analytics.GET as Handler,
      get(`/api/session/analytics?sessionId=${SESSION_ID}`),
    )

    expect(response.status).toBe(410)
    expect(await response.json()).toMatchObject({ code: LEGACY_SURFACE_CODE })
  })

  it('carries the stable exclusion body and a Deprecation header', async () => {
    state.query.mockRejectedValue(schemaError('42P01'))

    const response = await invoke(
      comparison.GET as Handler,
      get(`/api/session/comparison?sessionId=${SESSION_ID}`),
    )

    expect(response.status).toBe(410)
    expect(response.headers.get('Deprecation')).toBe('true')
    expect(await response.json()).toEqual({
      error: 'Legacy session analytics are not available',
      code: LEGACY_SURFACE_CODE,
    })
  })

  it('still surfaces genuine infrastructure errors as 500', async () => {
    state.query.mockRejectedValue(schemaError('08006'))

    const response = await invoke(
      comparison.GET as Handler,
      get(`/api/session/comparison?sessionId=${SESSION_ID}`),
    )

    expect(response.status).toBe(500)
  })

  it('keeps 401 for unauthenticated callers on every legacy route', async () => {
    mockGetSession.mockResolvedValue(null)

    const responses = await Promise.all([
      invoke(
        progress.POST as Handler,
        post('/api/session/progress', { sessionId: SESSION_ID }),
      ),
      invoke(
        progress.GET as Handler,
        get(`/api/session/progress?sessionId=${SESSION_ID}`),
      ),
      invoke(
        skills.POST as Handler,
        post('/api/session/skills', { sessionId: SESSION_ID }),
      ),
      invoke(skills.GET as Handler, get('/api/session/skills?sessionId=x')),
      invoke(
        comparison.POST as Handler,
        post('/api/session/comparison', { currentSessionId: SESSION_ID }),
      ),
      invoke(
        comparison.GET as Handler,
        get('/api/session/comparison?sessionId=x'),
      ),
      invoke(
        analytics.POST as Handler,
        post('/api/session/analytics', { sessionId: SESSION_ID }),
      ),
      invoke(
        analytics.GET as Handler,
        get('/api/session/analytics?sessionId=x'),
      ),
    ])

    expect(responses.map((response) => response.status)).toEqual([
      401, 401, 401, 401, 401, 401, 401, 401,
    ])
    expect(mockResolveInternalUserId).not.toHaveBeenCalled()
    expect(state.query).not.toHaveBeenCalled()
  })
})
