/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { initializeDatabase } from '../../../lib/db'
import { GET, POST } from '../../../pages/api/session/progress'

vi.mock('../../../lib/auth/session', () => ({
  getSession: vi.fn(),
}))
vi.mock('../../../lib/auth/internal-identity', () => ({
  resolveInternalUserId: async (principal: { id?: string } | null) =>
    principal?.id ?? null,
}))

import { getSession } from '../../../lib/auth/session'

/**
 * `sessions.id` is a uuid column and the route now validates the shape before
 * any statement runs, so a fixture whose id must pass the guard has to be a
 * real UUID. The previous sentinel strings (`test-session-123`,
 * `non-existent-session`) are kept as the malformed-identifier group at the
 * bottom of this file, where they assert the new `410` expectation.
 */
const SESSION_ID = '7a62430b-a01a-4eaf-8eb8-517e70ffb20d'
const MISSING_SESSION_ID = 'f1c0d0d4-6f0a-4e2c-9c56-2d5b1a0e7c11'
const MALFORMED_SESSION_ID = 'test-session-123'

type QueryResultStub = {
  rowCount: number
  rows: unknown[]
  command: string
  fields: unknown[]
}

type QueryFn = (query: string, values?: unknown[]) => Promise<QueryResultStub>

type MockClient = {
  query: ReturnType<typeof vi.fn<QueryFn>>
  release: ReturnType<typeof vi.fn<() => void>>
}

type ProgressRequest = {
  sessionId?: string
  progressMetrics?: {
    totalMessages: number
    progress: number
  }
  therapistId?: string
  evaluationFeedback?: string
}

type ErrorResponse = {
  error: string
}

type SuccessPostResponse = {
  success: boolean
  sessionId: string
}

type FeedbackRow = {
  therapist_id: string
  feedback: string
  created_at: string
}

type SuccessGetResponse = {
  sessionId: string
  progressMetrics: { totalMessages: number; progress: number }
  progressSnapshots: { timestamp: string; value: number }[]
  skillScores: Record<string, number>
  feedback: FeedbackRow[] | null
}

const mockClient: MockClient = {
  query: vi.fn<QueryFn>(),
  release: vi.fn<() => void>(),
}

const { mockConnect } = vi.hoisted(() => ({
  // A fresh object per connect keeps lib/db's pooled-client liveness probe out
  // of these handler assertions: it only probes a client the pool has already
  // handed out, and the shared query/release spies are what the assertions read.
  mockConnect: vi.fn(async (): Promise<MockClient> => ({
    query: mockClient.query,
    release: mockClient.release,
  })),
}))

vi.mock('pg', () => ({
  Pool: class {
    // initializeDatabase() registers pool error/connect listeners.
    on() {
      return this
    }

    async connect() {
      return mockConnect()
    }
  },
}))

// lib/db requires initializeDatabase() before getPool() will return a pool
// (gate added 2026-08-26). With 'pg' mocked above this only constructs the
// mock pool and sets the module flag; no real connection is made.
initializeDatabase()

const createMockQueryResult = (
  rowCount: number,
  rows: unknown[] = [],
): QueryResultStub => ({
  rowCount,
  rows,
  command: 'SELECT',
  fields: [],
})

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const hasErrorResponseShape = (value: unknown): value is ErrorResponse => {
  return (
    isObject(value) && 'error' in value && typeof value['error'] === 'string'
  )
}

const hasProgressMetricsShape = (
  value: unknown,
): value is { totalMessages: number; progress: number } => {
  return (
    isObject(value) &&
    typeof value['totalMessages'] === 'number' &&
    typeof value['progress'] === 'number'
  )
}

const hasFeedbackRowsShape = (value: unknown): value is FeedbackRow[] => {
  return (
    Array.isArray(value) &&
    value.every(
      (row): row is FeedbackRow =>
        isObject(row) &&
        typeof row['therapist_id'] === 'string' &&
        typeof row['feedback'] === 'string' &&
        typeof row['created_at'] === 'string',
    )
  )
}

const hasSnapshotRowsShape = (
  value: unknown,
): value is { timestamp: string; value: number }[] => {
  return (
    Array.isArray(value) &&
    value.every(
      (row): row is { timestamp: string; value: number } =>
        isObject(row) &&
        typeof row['timestamp'] === 'string' &&
        typeof row['value'] === 'number',
    )
  )
}

const hasSuccessPostShape = (value: unknown): value is SuccessPostResponse => {
  return (
    isObject(value) &&
    typeof value['success'] === 'boolean' &&
    typeof value['sessionId'] === 'string'
  )
}

const hasSuccessGetShape = (value: unknown): value is SuccessGetResponse => {
  if (!isObject(value)) return false
  if (typeof value['sessionId'] !== 'string') return false
  if (!hasProgressMetricsShape(value['progressMetrics'])) return false
  if (!hasSnapshotRowsShape(value['progressSnapshots'])) return false
  if (!hasFeedbackRowsShape(value['feedback']) && value['feedback'] !== null)
    return false
  return true
}

const parseResponseBody = async <T>(
  response: Response,
  isShape: (value: unknown) => value is T,
): Promise<T> => {
  const body = (await response.json()) as unknown
  if (!isShape(body)) {
    throw new Error(`Unexpected response shape: ${JSON.stringify(body)}`)
  }
  return body
}

const createPostRequest = (
  body: ProgressRequest,
): {
  request: { json: () => Promise<ProgressRequest> }
} => ({
  request: {
    json: async () => body,
  },
})

const createGetRequest = (
  url: string,
): {
  request: { url: string }
} => ({
  request: {
    url,
  },
})

describe('Session Progress API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClient.query.mockReset()
    mockClient.release.mockReset()
    mockConnect.mockReset()
    vi.mocked(getSession).mockResolvedValue({
      user: { id: 'therapist-123', role: 'therapist' },
      expires: new Date(Date.now() + 60_000).toISOString(),
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('POST /api/session/progress', () => {
    it('should save session progress metrics', async () => {
      const mockRequest = createPostRequest({
        sessionId: SESSION_ID,
        progressMetrics: { totalMessages: 10, progress: 50 },
        therapistId: 'therapist-123',
        evaluationFeedback: 'Good session',
      })

      const mockPoolClient = await mockConnect()
      mockPoolClient.query.mockResolvedValueOnce(createMockQueryResult(1))
      mockPoolClient.query.mockResolvedValueOnce(
        createMockQueryResult(1, [{ id: SESSION_ID }]),
      )
      mockPoolClient.query.mockResolvedValueOnce(createMockQueryResult(1))
      mockPoolClient.query.mockResolvedValueOnce(createMockQueryResult(1))
      mockPoolClient.query.mockResolvedValueOnce(createMockQueryResult(0))

      const response = await POST(mockRequest as any)
      const responseBody = await parseResponseBody(
        response,
        hasSuccessPostShape,
      )

      expect(response.status).toBe(200)
      expect(responseBody.success).toBe(true)
      expect(responseBody.sessionId).toBe(SESSION_ID)
      expect(mockPoolClient.query.mock.calls[1]?.[0]).toContain(
        'id = $1 AND therapist_id = $2 FOR UPDATE',
      )
      expect(mockPoolClient.query.mock.calls[1]?.[1]).toEqual([
        SESSION_ID,
        'therapist-123',
      ])
      expect(mockPoolClient.query.mock.calls[3]?.[0]).toContain(
        'INSERT INTO evaluations',
      )
      expect(mockPoolClient.query.mock.calls[3]?.[1]).toEqual([
        SESSION_ID,
        'therapist-123',
        'Good session',
      ])
    })

    it('should return 400 for missing sessionId', async () => {
      const mockRequest = createPostRequest({
        progressMetrics: { totalMessages: 10, progress: 50 },
      })

      const response = await POST(mockRequest as any)
      const responseBody = await parseResponseBody(
        response,
        hasErrorResponseShape,
      )

      expect(response.status).toBe(400)
      expect(responseBody.error).toBe('Missing required field: sessionId')
    })

    it('should return 404 for session not found', async () => {
      const mockRequest = createPostRequest({
        sessionId: MISSING_SESSION_ID,
        progressMetrics: { totalMessages: 10, progress: 50 },
      })

      const mockPoolClient = await mockConnect()
      mockPoolClient.query.mockResolvedValueOnce(createMockQueryResult(0))
      mockPoolClient.query.mockResolvedValueOnce(createMockQueryResult(0))

      const response = await POST(mockRequest as any)
      const responseBody = await parseResponseBody(
        response,
        hasErrorResponseShape,
      )

      expect(response.status).toBe(404)
      expect(responseBody.error).toBe('Session not found')
    })

    it('should handle database errors', async () => {
      const mockRequest = createPostRequest({
        sessionId: SESSION_ID,
        progressMetrics: { totalMessages: 10, progress: 50 },
      })

      const mockPoolClient = await mockConnect()
      mockPoolClient.query.mockResolvedValueOnce(createMockQueryResult(0))
      mockPoolClient.query.mockRejectedValueOnce(new Error('Database error'))

      const response = await POST(mockRequest as any)
      const responseBody = await parseResponseBody(
        response,
        hasErrorResponseShape,
      )

      expect(response.status).toBe(500)
      expect(responseBody.error).toBe('Internal server error')
    })
  })

  describe('GET /api/session/progress', () => {
    it('should retrieve session progress data', async () => {
      const mockRequest = createGetRequest(
        `http://localhost:3000/api/session/progress?sessionId=${SESSION_ID}&includeFeedback=true`,
      )

      const mockPoolClient = await mockConnect()
      mockPoolClient.query.mockResolvedValueOnce(
        createMockQueryResult(1, [
          {
            progress_metrics: { totalMessages: 10, progress: 50 },
            progress_snapshots: [
              { timestamp: '2025-01-01T10:00:00Z', value: 25 },
            ],
            skill_scores: { 'Active Listening': 85 },
          },
        ]),
      )
      mockPoolClient.query.mockResolvedValueOnce(
        createMockQueryResult(1, [
          {
            therapist_id: 'therapist-123',
            feedback: 'Good session',
            created_at: '2025-01-01T10:00:00Z',
          },
        ]),
      )

      const response = await GET(mockRequest)
      const responseBody = await parseResponseBody(response, hasSuccessGetShape)

      expect(response.status).toBe(200)
      expect(responseBody.sessionId).toBe(SESSION_ID)
      expect(responseBody.progressMetrics).toBeDefined()
      expect(responseBody.feedback).toHaveLength(1)
      expect(mockPoolClient.query.mock.calls[0]?.[0]).toContain(
        'id = $1 AND therapist_id = $2',
      )
      expect(mockPoolClient.query.mock.calls[0]?.[1]).toEqual([
        SESSION_ID,
        'therapist-123',
      ])
    })

    it('should return 400 for missing sessionId', async () => {
      const mockRequest = createGetRequest(
        'http://localhost:3000/api/session/progress',
      )

      const response = await GET(mockRequest)
      const responseBody = await parseResponseBody(
        response,
        hasErrorResponseShape,
      )

      expect(response.status).toBe(400)
      expect(responseBody.error).toBe('Missing sessionId parameter')
    })

    it('should return 404 for session not found', async () => {
      const mockRequest = createGetRequest(
        `http://localhost:3000/api/session/progress?sessionId=${MISSING_SESSION_ID}`,
      )

      const mockPoolClient = await mockConnect()
      mockPoolClient.query.mockResolvedValueOnce(createMockQueryResult(0))

      const response = await GET(mockRequest)
      const responseBody = await parseResponseBody(
        response,
        hasErrorResponseShape,
      )

      expect(response.status).toBe(404)
      expect(responseBody.error).toBe('Session not found')
    })

    it('should handle database errors', async () => {
      const mockRequest = createGetRequest(
        `http://localhost:3000/api/session/progress?sessionId=${SESSION_ID}`,
      )

      const mockPoolClient = await mockConnect()
      mockPoolClient.query.mockRejectedValueOnce(new Error('Database error'))

      const response = await GET(mockRequest)
      const responseBody = await parseResponseBody(
        response,
        hasErrorResponseShape,
      )

      expect(response.status).toBe(500)
      expect(responseBody.error).toBe('Internal server error')
    })
  })

  it('returns 401 for unauthenticated progress reads and writes', async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const postResponse = await POST(
      createPostRequest({ sessionId: SESSION_ID }) as never,
    )
    const getResponse = await GET(
      createGetRequest(
        `http://localhost:3000/api/session/progress?sessionId=${SESSION_ID}`,
      ) as never,
    )

    expect(postResponse.status).toBe(401)
    expect(getResponse.status).toBe(401)
    expect(mockConnect).not.toHaveBeenCalled()
  })

  describe('malformed identifier', () => {
    /**
     * `sessions.id` is a uuid column, so the old sentinel fixture reached the
     * ownership statement and PostgreSQL raised `22P02`, which the catch-all
     * answered as `500`. These routes are excluded from the pilot surface
     * regardless of body shape, so the malformed identifier takes the existing
     * `410` path instead.
     */
    const expectExcluded = async (response: Response) => {
      expect(response.status).toBe(410)
      expect(response.headers.get('Retry-After')).toBeNull()
      expect(await response.json()).toMatchObject({
        code: 'LEGACY_SESSION_API_UNAVAILABLE',
      })
      // The shape is checked before the client is acquired, which is what
      // proves the value never reaches a statement.
      expect(mockConnect).not.toHaveBeenCalled()
    }

    it('answers 410 for a non-UUID sessionId on POST', async () => {
      const response = await POST(
        createPostRequest({
          sessionId: MALFORMED_SESSION_ID,
          progressMetrics: { totalMessages: 10, progress: 50 },
        }) as never,
      )

      await expectExcluded(response)
    })

    it('answers 410 for a non-UUID sessionId on GET', async () => {
      const response = await GET(
        createGetRequest(
          `http://localhost:3000/api/session/progress?sessionId=${MALFORMED_SESSION_ID}`,
        ) as never,
      )

      await expectExcluded(response)
    })

    it('answers 410 for a malformed id even when no metrics are supplied', async () => {
      // The route is excluded regardless of body shape, so the identifier is
      // classified before the progress/feedback check.
      const response = await POST(
        createPostRequest({ sessionId: MALFORMED_SESSION_ID }) as never,
      )

      await expectExcluded(response)
    })
  })
})
