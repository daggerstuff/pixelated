/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GET, POST } from '../../../pages/api/session/progress'

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
  mockConnect: vi.fn(async (): Promise<MockClient> => mockClient),
}))

vi.mock('pg', () => ({
  Pool: class {
    async connect() {
      return mockConnect()
    }
  },
}))

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
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('POST /api/session/progress', () => {
    it('should save session progress metrics', async () => {
      const mockRequest = createPostRequest({
        sessionId: 'test-session-123',
        progressMetrics: { totalMessages: 10, progress: 50 },
        therapistId: 'therapist-123',
        evaluationFeedback: 'Good session',
      })

      const mockPoolClient = await mockConnect()
      mockPoolClient.query.mockResolvedValueOnce(createMockQueryResult(1))
      mockPoolClient.query.mockResolvedValueOnce(createMockQueryResult(1))

      const response = await POST(mockRequest as any)
      const responseBody = await parseResponseBody(
        response,
        hasSuccessPostShape,
      )

      expect(response.status).toBe(200)
      expect(responseBody.success).toBe(true)
      expect(responseBody.sessionId).toBe('test-session-123')
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
        sessionId: 'non-existent-session',
        progressMetrics: { totalMessages: 10, progress: 50 },
      })

      const mockPoolClient = await mockConnect()
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
        sessionId: 'test-session-123',
        progressMetrics: { totalMessages: 10, progress: 50 },
      })

      const mockPoolClient = await mockConnect()
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
        'http://localhost:3000/api/session/progress?sessionId=test-session-123&includeFeedback=true',
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
      expect(responseBody.sessionId).toBe('test-session-123')
      expect(responseBody.progressMetrics).toBeDefined()
      expect(responseBody.feedback).toHaveLength(1)
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
        'http://localhost:3000/api/session/progress?sessionId=non-existent-session',
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
        'http://localhost:3000/api/session/progress?sessionId=test-session-123',
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
})
