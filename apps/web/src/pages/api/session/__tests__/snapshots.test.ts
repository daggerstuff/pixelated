import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockConnect,
  mockQuery,
  mockRelease,
  mockGetSession,
  mockResolveInternalUserId,
} = vi.hoisted(() => ({
  mockConnect: vi.fn(),
  mockQuery: vi.fn(),
  mockRelease: vi.fn(),
  mockGetSession: vi.fn(),
  mockResolveInternalUserId: vi.fn(),
}))

vi.mock('@/lib/auth/session', () => ({ getSession: mockGetSession }))
vi.mock('@/lib/auth/internal-identity', () => ({
  resolveInternalUserId: mockResolveInternalUserId,
}))
vi.mock('@/lib/db', () => ({
  // The route must acquire through acquireClient(); mocking getPool() instead
  // would let a reverted direct borrow pass this suite unnoticed.
  acquireClient: mockConnect,
  isDatabaseUnavailableError: (error: unknown) =>
    error instanceof Error &&
    (/query read timeout|database statement exceeded|database statement could not complete within/i.test(
      error.message,
    ) ||
      ['08006', '08003', '57P01', 'ECONNREFUSED', 'ECONNRESET'].includes(
        (error as { code?: string }).code ?? '',
      )),
}))

import { GET, POST } from '../snapshots'

/** The provider subject `getSession()` exposes as `user.id`. */
const AUTH0_SUB = 'auth0|snapshots-caller'
/** The internal `users.id` UUID that `therapist_id` compares against. */
const USER_ID = '6cf52d73-8188-487f-a1c6-4ebc014328c0'
const SESSION_ID = 'bb682d68-2338-48f0-8ac5-e0243b1346d2'
const LEGACY_SURFACE_CODE = 'LEGACY_SESSION_API_UNAVAILABLE'

const createClient = () => ({ query: mockQuery, release: mockRelease })

const invoke = (
  handler: (context: never) => Promise<Response>,
  context: object,
) => (handler as unknown as (value: object) => Promise<Response>)(context)

const createRequest = (url: string, body?: unknown): Request =>
  new Request(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers:
      body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

const schemaError = (code: string) =>
  Object.assign(new Error(`simulated schema error ${code}`), { code })

const authenticatedSession = {
  user: { id: AUTH0_SUB, email: 'caller@example.test', role: 'therapist' },
  expires: new Date(Date.now() + 60_000).toISOString(),
}

beforeEach(() => {
  vi.clearAllMocks()
  mockQuery.mockReset()
  mockRelease.mockReset()
  mockGetSession.mockResolvedValue(authenticatedSession)
  mockResolveInternalUserId.mockResolvedValue(USER_ID)
  mockConnect.mockResolvedValue(createClient())
})

describe('session snapshots authorization', () => {
  it('rejects unauthenticated reads and writes before database access', async () => {
    mockGetSession.mockResolvedValue(null)

    const getResponse = await invoke(GET, {
      request: createRequest(
        `http://localhost/api/session/snapshots?sessionId=${SESSION_ID}`,
      ),
    })
    const postResponse = await invoke(POST, {
      request: createRequest('http://localhost/api/session/snapshots', {
        sessionId: SESSION_ID,
        snapshots: [],
      }),
    })

    expect(getResponse.status).toBe(401)
    expect(postResponse.status).toBe(401)
    expect(mockResolveInternalUserId).not.toHaveBeenCalled()
    expect(mockConnect).not.toHaveBeenCalled()
  })

  it('denies an unmapped principal without touching the database', async () => {
    mockResolveInternalUserId.mockResolvedValue(null)

    const getResponse = await invoke(GET, {
      request: createRequest(
        `http://localhost/api/session/snapshots?sessionId=${SESSION_ID}`,
      ),
    })
    const postResponse = await invoke(POST, {
      request: createRequest('http://localhost/api/session/snapshots', {
        sessionId: SESSION_ID,
        snapshots: [{ timestamp: '2026-11-04T00:00:00.000Z', value: 25 }],
      }),
    })

    expect(getResponse.status).toBe(403)
    expect(postResponse.status).toBe(403)
    expect(await getResponse.json()).toMatchObject({
      error: 'User identity not resolved',
    })
    expect(mockConnect).not.toHaveBeenCalled()
  })

  it('resolves the principal before the ownership comparison and scopes writes to the internal uuid', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: SESSION_ID }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })

    const response = await invoke(POST, {
      request: createRequest('http://localhost/api/session/snapshots', {
        sessionId: SESSION_ID,
        snapshots: [{ timestamp: '2026-11-04T00:00:00.000Z', value: 25 }],
      }),
    })

    expect(response.status).toBe(200)
    expect(mockResolveInternalUserId).toHaveBeenCalledWith(
      authenticatedSession.user,
      { propagateDatabaseErrors: true },
    )
    expect(mockQuery.mock.calls[1]?.[0]).toContain(
      'id = $1 AND therapist_id = $2 FOR UPDATE',
    )
    expect(mockQuery.mock.calls[1]?.[1]).toEqual([SESSION_ID, USER_ID])
    expect(mockQuery.mock.calls[2]?.[1]).toEqual([
      JSON.stringify([{ timestamp: '2026-11-04T00:00:00.000Z', value: 25 }]),
      SESSION_ID,
      USER_ID,
    ])
    // The raw Auth0 subject must never reach the uuid column.
    expect(
      mockQuery.mock.calls.some((call) =>
        JSON.stringify(call[1] ?? []).includes(AUTH0_SUB),
      ),
    ).toBe(false)
    expect(mockQuery.mock.calls.at(-1)?.[0]).toBe('COMMIT')
  })

  it('conceals snapshots owned by another user', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] })

    const response = await invoke(GET, {
      request: createRequest(
        `http://localhost/api/session/snapshots?sessionId=${SESSION_ID}`,
      ),
    })

    expect(response.status).toBe(404)
    expect(mockQuery.mock.calls[0]?.[0]).toContain(
      'id = $1 AND therapist_id = $2',
    )
    expect(mockQuery.mock.calls[0]?.[1]).toEqual([SESSION_ID, USER_ID])
  })

  it('rejects invalid timestamps and oversized batches', async () => {
    const invalidTimestamp = await invoke(POST, {
      request: createRequest('http://localhost/api/session/snapshots', {
        sessionId: SESSION_ID,
        snapshots: [{ timestamp: 'not-a-date', value: 25 }],
      }),
    })
    const oversized = await invoke(POST, {
      request: createRequest('http://localhost/api/session/snapshots', {
        sessionId: SESSION_ID,
        snapshots: Array.from({ length: 501 }, (_, value) => ({
          timestamp: '2026-11-04T00:00:00.000Z',
          value,
        })),
      }),
    })

    expect(invalidTimestamp.status).toBe(400)
    expect(oversized.status).toBe(400)
    expect(mockConnect).not.toHaveBeenCalled()
  })
})

describe('session snapshots with malformed input', () => {
  /**
   * Stable shape for a request that cannot be understood. Distinct from the
   * `410` exclusion code and from the retryable `503` code, so a caller can
   * tell malformed input apart from a gone surface and from a retryable failure.
   */
  const INVALID_REQUEST_CODE = 'LEGACY_SESSION_INVALID_REQUEST'

  /**
   * The tokens PostgreSQL puts in its `22P02` message. None of them, nor a
   * statement fragment or a table name, may reach the client.
   */
  const LEAKS = [
    '22P02',
    'invalid input syntax',
    'select',
    'sessions',
    'therapist_id',
    'progress_snapshots',
  ]

  const expectInvalidRequest = async (response: Response, message: string) => {
    expect(response.status).toBe(400)
    const body: unknown = await response.json()
    expect(body).toEqual({ error: message, code: INVALID_REQUEST_CODE })
    const serialised = JSON.stringify(body).toLowerCase()
    for (const leak of LEAKS) {
      expect(serialised).not.toContain(leak)
    }
  }

  /** A POST whose body is not JSON at all, so `request.json()` throws. */
  const createRawRequest = (url: string, body: string): Request =>
    new Request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

  it('rejects a non-UUID sessionId on GET before any statement runs', async () => {
    const response = await invoke(GET, {
      request: createRequest(
        'http://localhost/api/session/snapshots?sessionId=not-a-uuid',
      ),
    })

    await expectInvalidRequest(response, 'Invalid sessionId: expected a UUID')
    // `22P02` is raised by the statement, so the guard must run before the
    // client is acquired at all.
    expect(mockConnect).not.toHaveBeenCalled()
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects a non-UUID sessionId on POST before any statement runs', async () => {
    const response = await invoke(POST, {
      request: createRequest('http://localhost/api/session/snapshots', {
        sessionId: 'not-a-uuid',
        snapshots: [{ timestamp: '2026-11-04T00:00:00.000Z', value: 25 }],
      }),
    })

    await expectInvalidRequest(response, 'Invalid sessionId: expected a UUID')
    expect(mockConnect).not.toHaveBeenCalled()
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('answers 400 for a body that is not valid JSON', async () => {
    const response = await invoke(POST, {
      request: createRawRequest(
        'http://localhost/api/session/snapshots',
        '{"sessionId": "bb682d68-2338-48f0-8ac5-e0243b1346d2", "snapshots": [',
      ),
    })

    await expectInvalidRequest(response, 'Invalid JSON body')
    expect(mockConnect).not.toHaveBeenCalled()
  })

  it('answers 400 for an empty body', async () => {
    const response = await invoke(POST, {
      request: createRawRequest('http://localhost/api/session/snapshots', ''),
    })

    await expectInvalidRequest(response, 'Invalid JSON body')
    expect(mockConnect).not.toHaveBeenCalled()
  })

  it('keeps 500 for a genuine infrastructure failure on the write path', async () => {
    // A PostgreSQL internal error is not a malformed request and is not
    // retryable, so it must stay a 5xx rather than being folded into the new
    // 400 mapping.
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK')
        return { rowCount: 0, rows: [] }
      if (sql.includes('FOR UPDATE')) {
        throw schemaError('XX000')
      }
      throw new Error(`unexpected statement: ${sql}`)
    })

    const response = await invoke(POST, {
      request: createRequest('http://localhost/api/session/snapshots', {
        sessionId: SESSION_ID,
        snapshots: [{ timestamp: '2026-11-04T00:00:00.000Z', value: 25 }],
      }),
    })

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Internal server error' })
  })
})

describe('session snapshots on absent schema', () => {
  it('returns the documented 410 exclusion when sessions.progress_snapshots is absent', async () => {
    mockQuery.mockRejectedValue(schemaError('42703'))

    const response = await invoke(GET, {
      request: createRequest(
        `http://localhost/api/session/snapshots?sessionId=${SESSION_ID}`,
      ),
    })

    expect(response.status).toBe(410)
    expect(response.headers.get('Deprecation')).toBe('true')
    expect(await response.json()).toEqual({
      error: 'Legacy session analytics are not available',
      code: LEGACY_SURFACE_CODE,
    })
  })

  it('returns the documented 410 exclusion when a snapshot write hits absent schema', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK')
        return { rowCount: 0, rows: [] }
      if (sql.includes('FOR UPDATE')) {
        return { rowCount: 1, rows: [{ id: SESSION_ID }] }
      }
      throw schemaError('42703')
    })

    const response = await invoke(POST, {
      request: createRequest('http://localhost/api/session/snapshots', {
        sessionId: SESSION_ID,
        snapshots: [{ timestamp: '2026-11-04T00:00:00.000Z', value: 25 }],
      }),
    })

    expect(response.status).toBe(410)
    expect(await response.json()).toMatchObject({ code: LEGACY_SURFACE_CODE })
    expect(mockQuery.mock.calls.at(-1)?.[0]).toBe('ROLLBACK')
  })

  it('returns the documented 410 exclusion when session_milestones is absent', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ progress_snapshots: [] }],
      })
      .mockRejectedValueOnce(schemaError('42P01'))

    const response = await invoke(GET, {
      request: createRequest(
        `http://localhost/api/session/snapshots?sessionId=${SESSION_ID}`,
      ),
    })

    expect(response.status).toBe(410)
    expect(await response.json()).toMatchObject({ code: LEGACY_SURFACE_CODE })
  })

  it('still surfaces genuine non-availability infrastructure errors as 500', async () => {
    // `08006` is a connection loss, which the availability mapping answers as
    // retryable. A PostgreSQL internal error is not retryable and stays 500.
    mockQuery.mockRejectedValue(schemaError('XX000'))

    const response = await invoke(GET, {
      request: createRequest(
        `http://localhost/api/session/snapshots?sessionId=${SESSION_ID}`,
      ),
    })

    expect(response.status).toBe(500)
  })
})

describe('session snapshots when a statement hits the query bound', () => {
  /** The bare `Error` pg raises from the pool-level `query_timeout`. */
  const queryReadTimeout = () => new Error('Query read timeout')
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

  it('GET answers the retryable status instead of 500', async () => {
    mockQuery.mockRejectedValue(queryReadTimeout())

    const response = await invoke(GET, {
      request: createRequest(
        `http://localhost/api/session/snapshots?sessionId=${SESSION_ID}`,
      ),
    })

    await expectRetryable(response)
  })

  it('POST answers the retryable status without inviting a duplicate write', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN') return { rowCount: 0, rows: [] }
      if (sql.includes('FOR UPDATE')) throw queryReadTimeout()
      throw new Error(`unexpected statement: ${sql}`)
    })

    const response = await invoke(POST, {
      request: createRequest('http://localhost/api/session/snapshots', {
        sessionId: SESSION_ID,
        snapshots: [{ timestamp: '2026-11-04T00:00:00.000Z', value: 25 }],
      }),
    })

    await expectRetryable(response, { advertiseRetry: false })
    expect(mockQuery).not.toHaveBeenCalledWith('ROLLBACK')
    expect(mockRelease).toHaveBeenCalledWith(true)
  })

  it('answers 503 instead of 500 when the identity lookup loses the connection', async () => {
    mockResolveInternalUserId.mockRejectedValue(
      Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
        code: '08006',
      }),
    )

    const response = await invoke(GET, {
      request: createRequest(
        `http://localhost/api/session/snapshots?sessionId=${SESSION_ID}`,
      ),
    })

    await expectRetryable(response)
  })

  it('answers 503 instead of 403 when the identity lookup hits the bound', async () => {
    mockResolveInternalUserId.mockRejectedValue(queryReadTimeout())

    const getResponse = await invoke(GET, {
      request: createRequest(
        `http://localhost/api/session/snapshots?sessionId=${SESSION_ID}`,
      ),
    })
    const postResponse = await invoke(POST, {
      request: createRequest('http://localhost/api/session/snapshots', {
        sessionId: SESSION_ID,
        snapshots: [{ timestamp: '2026-11-04T00:00:00.000Z', value: 25 }],
      }),
    })

    // The identity-resolution branch and the handler-level branch must agree:
    // a POST may have written, so neither advertises a retry delay.
    await expectRetryable(getResponse)
    await expectRetryable(postResponse, { advertiseRetry: false })
    expect(mockResolveInternalUserId).toHaveBeenCalledWith(
      expect.objectContaining({ id: AUTH0_SUB }),
      { propagateDatabaseErrors: true },
    )
  })

  it('POST keeps 410 for absent schema even when the rollback fails', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN') return { rowCount: 0, rows: [] }
      if (sql === 'ROLLBACK') {
        throw new Error(
          'Client has encountered a connection error and is not queryable',
        )
      }
      if (sql.includes('FOR UPDATE')) return { rowCount: 1, rows: [] }
      throw schemaError('42703')
    })

    const response = await invoke(POST, {
      request: createRequest('http://localhost/api/session/snapshots', {
        sessionId: SESSION_ID,
        snapshots: [{ timestamp: '2026-11-04T00:00:00.000Z', value: 25 }],
      }),
    })

    expect(response.status).toBe(410)
    expect(await response.json()).toMatchObject({ code: LEGACY_SURFACE_CODE })
    expect(mockQuery).toHaveBeenCalledWith('ROLLBACK')
    expect(mockRelease).toHaveBeenCalledWith(true)
  })
})
