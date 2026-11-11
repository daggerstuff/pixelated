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
  isDatabaseUnavailableError: (error: unknown) =>
    error instanceof Error &&
    (/query read timeout|database statement exceeded|database statement could not complete within/i.test(
      error.message,
    ) ||
      ['08006', '08003', '57P01', 'ECONNREFUSED', 'ECONNRESET'].includes(
        (error as { code?: string }).code ?? '',
      )),
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
    expect(state.query).toHaveBeenCalledWith('ROLLBACK')
    expect(state.release).toHaveBeenCalledWith()
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

  it('still surfaces genuine non-availability infrastructure errors as 500', async () => {
    // `08006` is a connection loss, which the availability mapping answers as
    // retryable. A PostgreSQL internal error is not retryable and stays 500.
    state.query.mockRejectedValue(schemaError('XX000'))

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

describe('legacy /api/session/* routes when a statement hits the query bound', () => {
  /**
   * The shape pg raises when the pool-level `query_timeout` abandons a
   * statement: a bare `Error` with this message and no `code`. Measured on
   * `249c558c4` / Worker `7542a5d3` as the cause of the 500 regression.
   */
  const queryReadTimeout = () => new Error('Query read timeout')

  /**
   * The shape pg raises when a statement is abandoned because the connection
   * was destroyed by the client-side bound — what the route's own `ROLLBACK`
   * then hits. It is not a query timeout, so it must never mask the original.
   */
  const destroyedConnection = () =>
    new Error('Client has encountered a connection error and is not queryable')

  const RETRYABLE_CODE = 'LEGACY_SESSION_API_TEMPORARILY_UNAVAILABLE'

  const expectRetryable = async (
    response: Response,
    options: { advertiseRetry?: boolean } = {},
  ) => {
    expect(response.status).toBe(503)
    if (options.advertiseRetry === false) {
      expect(response.headers.get('Retry-After')).toBeNull()
    } else {
      expect(response.headers.get('Retry-After')).toBe('1')
    }
    expect(await response.json()).toEqual({
      error: 'Legacy session analytics are temporarily unavailable',
      code: RETRYABLE_CODE,
    })
  }

  it('progress GET answers the retryable status instead of 500', async () => {
    state.query.mockRejectedValue(queryReadTimeout())

    const response = await invoke(
      progress.GET as Handler,
      get(`/api/session/progress?sessionId=${SESSION_ID}`),
    )

    await expectRetryable(response)
  })

  it('progress POST answers the retryable status without inviting a duplicate write', async () => {
    state.query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN') return ok()
      if (sql.includes('FOR UPDATE')) throw queryReadTimeout()
      throw new Error(`unexpected statement: ${sql}`)
    })

    const response = await invoke(
      progress.POST as Handler,
      post('/api/session/progress', {
        sessionId: SESSION_ID,
        progressMetrics: { totalMessages: 1, progress: 50 },
      }),
    )

    await expectRetryable(response, { advertiseRetry: false })
    expect(state.query).not.toHaveBeenCalledWith('ROLLBACK')
    expect(state.release).toHaveBeenCalledWith(true)
  })

  it('destroys the client when the rollback itself fails', async () => {
    state.query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN') return ok()
      if (sql === 'ROLLBACK') throw destroyedConnection()
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
    expect(state.query).toHaveBeenCalledWith('ROLLBACK')
    expect(state.release).toHaveBeenCalledWith(true)
  })

  it('answers 503 instead of 500 when the identity lookup loses the connection', async () => {
    mockResolveInternalUserId.mockRejectedValue(
      Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
        code: '08006',
      }),
    )

    const response = await invoke(
      comparison.GET as Handler,
      get(`/api/session/comparison?sessionId=${SESSION_ID}`),
    )

    await expectRetryable(response)
  })

  it('answers 503 instead of 403 when the identity lookup hits the bound', async () => {
    mockResolveInternalUserId.mockRejectedValue(queryReadTimeout())

    const getResponse = await invoke(
      progress.GET as Handler,
      get(`/api/session/progress?sessionId=${SESSION_ID}`),
    )
    const postResponse = await invoke(
      progress.POST as Handler,
      post('/api/session/progress', {
        sessionId: SESSION_ID,
        progressMetrics: { totalMessages: 1, progress: 50 },
      }),
    )

    await expectRetryable(getResponse)
    // The identity-resolution branch and the handler-level branch must agree:
    // a POST may have written, so neither advertises a retry delay.
    await expectRetryable(postResponse, { advertiseRetry: false })
    expect(mockResolveInternalUserId).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'auth0|legacy-caller' }),
      { propagateDatabaseErrors: true },
    )
  })

  it('skills GET answers the retryable status instead of 500', async () => {
    state.query.mockRejectedValue(queryReadTimeout())

    const response = await invoke(
      skills.GET as Handler,
      get(`/api/session/skills?therapistId=me`),
    )

    await expectRetryable(response)
  })

  it('skills POST answers the retryable status instead of 500', async () => {
    state.query.mockRejectedValue(queryReadTimeout())

    const response = await invoke(
      skills.POST as Handler,
      post('/api/session/skills', {
        sessionId: SESSION_ID,
        skillScores: { 'Active Listening': 80 },
      }),
    )

    await expectRetryable(response, { advertiseRetry: false })
  })

  it('comparison GET answers the retryable status instead of 500', async () => {
    state.query.mockRejectedValue(queryReadTimeout())

    const response = await invoke(
      comparison.GET as Handler,
      get(`/api/session/comparison?sessionId=${SESSION_ID}`),
    )

    await expectRetryable(response)
  })

  it('comparison POST answers the retryable status instead of 500', async () => {
    state.query.mockRejectedValue(queryReadTimeout())

    const response = await invoke(
      comparison.POST as Handler,
      post('/api/session/comparison', {
        currentSessionId: SESSION_ID,
        improvementScore: 10,
        metrics: { empathy: 1 },
      }),
    )

    await expectRetryable(response, { advertiseRetry: false })
  })

  it('analytics GET answers the retryable status instead of 500', async () => {
    state.query.mockRejectedValue(queryReadTimeout())

    const response = await invoke(
      analytics.GET as Handler,
      get(`/api/session/analytics?sessionId=${SESSION_ID}`),
    )

    await expectRetryable(response)
  })

  it('analytics POST answers the retryable status instead of 500', async () => {
    state.query.mockRejectedValue(queryReadTimeout())

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

    await expectRetryable(response, { advertiseRetry: false })
  })

  it('maps a server-side statement timeout (57014) the same way', async () => {
    state.query.mockRejectedValue(
      Object.assign(new Error('canceling statement due to statement timeout'), {
        code: '57014',
      }),
    )

    const response = await invoke(
      comparison.GET as Handler,
      get(`/api/session/comparison?sessionId=${SESSION_ID}`),
    )

    await expectRetryable(response)
  })

  it('keeps the retryable body free of pg codes, statement text and table names', async () => {
    state.query.mockRejectedValue(
      Object.assign(new Error('Query read timeout'), {
        detail: 'SELECT * FROM evaluations WHERE session_id = $1',
      }),
    )

    const response = await invoke(
      comparison.GET as Handler,
      get(`/api/session/comparison?sessionId=${SESSION_ID}`),
    )

    const body = JSON.stringify(await response.json())
    expect(response.status).toBe(503)
    for (const leak of [
      'Query read timeout',
      'timeout',
      '57014',
      '42P01',
      '42703',
      'SELECT',
      'evaluations',
      'session_comparisons',
      'sessions',
    ]) {
      expect(body.toLowerCase()).not.toContain(leak.toLowerCase())
    }
  })

  it('still answers 410 for absent schema and 500 for a non-availability infrastructure error', async () => {
    state.query.mockRejectedValue(schemaError('42P01'))
    const schemaResponse = await invoke(
      comparison.GET as Handler,
      get(`/api/session/comparison?sessionId=${SESSION_ID}`),
    )
    expect(schemaResponse.status).toBe(410)

    state.query.mockRejectedValue(schemaError('XX000'))
    const infrastructureResponse = await invoke(
      comparison.GET as Handler,
      get(`/api/session/comparison?sessionId=${SESSION_ID}`),
    )
    expect(infrastructureResponse.status).toBe(500)
  })
})

describe('legacy /api/session/* POST withholds the retry advertisement on identity resolution', () => {
  /**
   * `resolveLegacyTherapistId()` answers the same retryable `503` the handlers
   * map in their own `catch`. A GET may advertise `Retry-After` there; a POST
   * must not, because the write may have committed before the failure. Before
   * this repair the identity branch used the helper's default and advertised
   * it, so the two branches disagreed on exactly the same status.
   */
  const identityBound = () => new Error('Query read timeout')

  const RETRYABLE_CODE = 'LEGACY_SESSION_API_TEMPORARILY_UNAVAILABLE'

  const expectWithheld = async (response: Response) => {
    expect(response.status).toBe(503)
    expect(response.headers.get('Retry-After')).toBeNull()
    expect(await response.json()).toEqual({
      error: 'Legacy session analytics are temporarily unavailable',
      code: RETRYABLE_CODE,
    })
  }

  beforeEach(() => {
    mockResolveInternalUserId.mockRejectedValue(identityBound())
  })

  it('progress POST carries no Retry-After when identity resolution fails', async () => {
    const response = await invoke(
      progress.POST as Handler,
      post('/api/session/progress', {
        sessionId: SESSION_ID,
        progressMetrics: { totalMessages: 1, progress: 50 },
      }),
    )

    await expectWithheld(response)
  })

  it('skills POST carries no Retry-After when identity resolution fails', async () => {
    const response = await invoke(
      skills.POST as Handler,
      post('/api/session/skills', {
        sessionId: SESSION_ID,
        skillScores: { 'Active Listening': 80 },
      }),
    )

    await expectWithheld(response)
  })

  it('comparison POST carries no Retry-After when identity resolution fails', async () => {
    const response = await invoke(
      comparison.POST as Handler,
      post('/api/session/comparison', {
        currentSessionId: SESSION_ID,
        improvementScore: 10,
        metrics: { empathy: 1 },
      }),
    )

    await expectWithheld(response)
  })

  it('analytics POST carries no Retry-After when identity resolution fails', async () => {
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

    await expectWithheld(response)
  })

  it('a GET on the same surface still advertises the retry delay', async () => {
    const response = await invoke(
      progress.GET as Handler,
      get(`/api/session/progress?sessionId=${SESSION_ID}`),
    )

    expect(response.status).toBe(503)
    expect(response.headers.get('Retry-After')).toBe('1')
    expect(await response.json()).toMatchObject({ code: RETRYABLE_CODE })
  })

  it('makes the identity branch and the handler branch produce the same POST headers', async () => {
    const identityResponse = await invoke(
      progress.POST as Handler,
      post('/api/session/progress', {
        sessionId: SESSION_ID,
        progressMetrics: { totalMessages: 1, progress: 50 },
      }),
    )

    // The same route failing later, in its own statement, is the branch the
    // handler already mapped with `advertiseRetry: false`.
    mockResolveInternalUserId.mockResolvedValue(USER_UUID)
    state.query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN') return ok()
      if (sql.includes('FOR UPDATE')) throw identityBound()
      throw new Error(`unexpected statement: ${sql}`)
    })
    const handlerResponse = await invoke(
      progress.POST as Handler,
      post('/api/session/progress', {
        sessionId: SESSION_ID,
        progressMetrics: { totalMessages: 1, progress: 50 },
      }),
    )

    await expectWithheld(identityResponse)
    await expectWithheld(handlerResponse)
    expect([...identityResponse.headers.keys()].sort()).toEqual(
      [...handlerResponse.headers.keys()].sort(),
    )
  })
})
