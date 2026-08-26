import type { APIContext } from 'astro'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { AstroCookies } from '../../../../../../node_modules/astro/dist/core/cookies/cookies.js'
import { POST, GET } from '../../../pages/api/session/skills'

type MockPoolClient = {
  query: ReturnType<typeof vi.fn<QueryFn>>
  release: ReturnType<typeof vi.fn>
}

type QueryFn = (
  query: string,
  values?: unknown[],
) => Promise<{
  rowCount?: number
  rows?: unknown[]
}>

type SkillRecord = Record<string, number>

type SkillsPostRequest = {
  sessionId?: string
  therapistId?: string
  skillScores?: SkillRecord
}

type PostSuccessResponse = {
  success: true
  sessionId: string
  therapistId: string
}

type ErrorResponse = {
  error: string
}

type SessionSkillsResponse = {
  sessionId: string
  skillScores: SkillRecord
}

type TherapistSkillRow = {
  skill_name: string
  skill_category: string
  current_score: number
  practice_sessions: number
  last_practiced: string
  created_at: string
}

type TherapistSkillsResponse = {
  therapistId: string
  skills: TherapistSkillRow[]
}

const mockClient: MockPoolClient = {
  query: vi.fn<QueryFn>(),
  release: vi.fn(),
}

const { mockConnect } = vi.hoisted(() => ({
  mockConnect: vi.fn(async () => mockClient),
}))

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

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

const hasErrorResponse = (value: unknown): value is ErrorResponse =>
  isObject(value) && typeof value['error'] === 'string'

const hasPostSuccessResponse = (value: unknown): value is PostSuccessResponse =>
  isObject(value) &&
  typeof value['success'] === 'boolean' &&
  typeof value['sessionId'] === 'string' &&
  typeof value['therapistId'] === 'string'

const hasSessionSkillsResponse = (
  value: unknown,
): value is SessionSkillsResponse =>
  isObject(value) &&
  typeof value['sessionId'] === 'string' &&
  isObject(value['skillScores'])

const hasTherapistSkillRow = (value: unknown): value is TherapistSkillRow =>
  isObject(value) &&
  typeof value['skill_name'] === 'string' &&
  typeof value['skill_category'] === 'string' &&
  typeof value['current_score'] === 'number' &&
  typeof value['practice_sessions'] === 'number' &&
  typeof value['last_practiced'] === 'string' &&
  typeof value['created_at'] === 'string'

const hasTherapistSkillsResponse = (
  value: unknown,
): value is TherapistSkillsResponse =>
  isObject(value) &&
  typeof value['therapistId'] === 'string' &&
  Array.isArray(value['skills']) &&
  value['skills'].every(hasTherapistSkillRow)

const createRequestContext = (request: Request): APIContext => ({
  site: undefined,
  generator: 'test',
  clientAddress: '127.0.0.1',
  cookies: new AstroCookies(request),
  session: undefined,
  cache: {
    enabled: false,
    set: () => undefined,
    tags: [],
    options: {},
    invalidate: async () => undefined,
  },
  request,
  url: new URL(request.url),
  originPathname: new URL(request.url).pathname,
  getActionResult: () => {
    throw new Error('not implemented in tests')
  },
  callAction: async () => {
    throw new Error('not implemented in tests')
  },
  params: {},
  props: {},
  redirect: (path: string, status = 302) =>
    new Response(null, { status, headers: { Location: path } }),
  rewrite: async () => new Response(null),
  locals: {
    requestId: 'test-request',
    timestamp: new Date().toISOString(),
    user: null,
    session: null,
  },
  preferredLocale: undefined,
  preferredLocaleList: undefined,
  currentLocale: undefined,
  isPrerendered: false,
  csp: undefined,
  logger: {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  },
  routePattern: '/api/session/skills',
})

const createPostContext = (
  body: SkillsPostRequest,
): Parameters<typeof POST>[0] =>
  createRequestContext(
    new Request('http://localhost/api/session/skills', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    }),
  )

const createGetContext = (url: string): Parameters<typeof GET>[0] =>
  createRequestContext(new Request(url))

vi.mock('pg', () => ({
  Pool: class {
    async connect() {
      return mockConnect()
    }
  },
}))

describe('Session Skills API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClient.query.mockReset()
    mockClient.release.mockReset()
    mockConnect.mockReset()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('POST /api/session/skills', () => {
    it('should save skill scores with batched INSERT query', async () => {
      const skillScores = {
        'Active Listening': 85,
        'Empathy': 90,
        'Technical Skills': 75,
        'Interpersonal Communication': 80,
      }

      const mockRequest = {
        sessionId: 'test-session-123',
        therapistId: 'therapist-123',
        skillScores,
      }

      const mockClient = await mockConnect()
      // Mock session update
      mockClient.query.mockResolvedValueOnce({ rowCount: 1 })
      // Mock batched skill insert
      mockClient.query.mockResolvedValueOnce({ rowCount: 4 })

      const response = await POST(createPostContext(mockRequest))
      const responseBody = await parseResponseBody(
        response,
        hasPostSuccessResponse,
      )

      expect(response.status).toBe(200)
      expect(responseBody.success).toBe(true)
      expect(responseBody.sessionId).toBe('test-session-123')

      // Verify session update query
      expect(mockClient.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('UPDATE sessions'),
        [JSON.stringify(skillScores), 'test-session-123'],
      )

      // Verify batched skill insert query
      expect(mockClient.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO skill_development'),
        expect.arrayContaining([
          'therapist-123',
          'Active Listening',
          'interpersonal',
          85,
          1,
          'therapist-123',
          'Empathy',
          'interpersonal',
          90,
          1,
          'therapist-123',
          'Technical Skills',
          'technical',
          75,
          1,
          'therapist-123',
          'Interpersonal Communication',
          'interpersonal',
          80,
          1,
        ]),
      )

      // Verify only 2 queries were executed (not N+1)
      expect(mockClient.query).toHaveBeenCalledTimes(2)
    })

    it('should handle skill category classification correctly', async () => {
      const skillScores = {
        'Active Listening': 85,
        'Technical Analysis': 75,
        'Interpersonal Skills': 80,
        'Therapeutic Intervention': 90,
      }

      const mockRequest = {
        sessionId: 'test-session-123',
        therapistId: 'therapist-123',
        skillScores,
      }

      const mockClient = await mockConnect()
      mockClient.query.mockResolvedValueOnce({ rowCount: 1 }) // Session update
      mockClient.query.mockResolvedValueOnce({ rowCount: 4 }) // Batched insert

      await POST(createPostContext(mockRequest))

      // Verify the batched query parameters include correct categories
      expect(mockClient.query).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.arrayContaining([
          'therapist-123',
          'Active Listening',
          'interpersonal',
          85,
          1,
          'therapist-123',
          'Technical Analysis',
          'technical',
          75,
          1,
          'therapist-123',
          'Interpersonal Skills',
          'interpersonal',
          80,
          1,
          'therapist-123',
          'Therapeutic Intervention',
          'therapeutic',
          90,
          1,
        ]),
      )
    })

    it('should return 400 for missing required fields', async () => {
      const mockRequest = {
        sessionId: 'test-session-123',
        // Missing therapistId and skillScores
      }

      const response = await POST(createPostContext(mockRequest))
      const responseBody = await parseResponseBody(response, hasErrorResponse)

      expect(response.status).toBe(400)
      expect(responseBody.error).toBe(
        'Missing required fields: sessionId, therapistId, skillScores',
      )
    })

    it('should return 404 for session not found', async () => {
      const mockRequest = {
        sessionId: 'non-existent-session',
        therapistId: 'therapist-123',
        skillScores: { 'Test Skill': 50 },
      }

      const mockClient = await mockConnect()
      mockClient.query.mockResolvedValueOnce({ rowCount: 0 }) // Session not found

      const response = await POST(createPostContext(mockRequest))
      const responseBody = await parseResponseBody(response, hasErrorResponse)

      expect(response.status).toBe(404)
      expect(responseBody.error).toBe('Session not found')
    })

    it('should handle empty skill scores gracefully', async () => {
      const mockRequest = {
        sessionId: 'test-session-123',
        therapistId: 'therapist-123',
        skillScores: {},
      }

      const mockClient = await mockConnect()
      mockClient.query.mockResolvedValueOnce({ rowCount: 1 }) // Session update

      const response = await POST(createPostContext(mockRequest))
      const responseBody = await parseResponseBody(
        response,
        hasPostSuccessResponse,
      )

      expect(response.status).toBe(200)
      expect(responseBody.success).toBe(true)

      // Should only execute session update, no skill insert
      expect(mockClient.query).toHaveBeenCalledTimes(1)
    })

    it('should handle database errors', async () => {
      const mockRequest = {
        sessionId: 'test-session-123',
        therapistId: 'therapist-123',
        skillScores: { 'Test Skill': 50 },
      }

      const mockClient = await mockConnect()
      mockClient.query.mockRejectedValueOnce(new Error('Database error'))

      const response = await POST(createPostContext(mockRequest))
      const responseBody = await parseResponseBody(response, hasErrorResponse)

      expect(response.status).toBe(500)
      expect(responseBody.error).toBe('Internal server error')
    })
  })

  describe('GET /api/session/skills', () => {
    it('should retrieve skill scores from specific session', async () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/session/skills?sessionId=test-session-123',
      }

      const mockClient = await mockConnect()
      mockClient.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            skill_scores: { 'Active Listening': 85, 'Empathy': 90 },
          },
        ],
      })

      const response = await GET(createGetContext(mockRequest.url))
      const responseBody = await parseResponseBody(
        response,
        hasSessionSkillsResponse,
      )

      expect(response.status).toBe(200)
      expect(responseBody.sessionId).toBe('test-session-123')
      expect(responseBody.skillScores).toEqual({
        'Active Listening': 85,
        'Empathy': 90,
      })
    })

    it("should retrieve therapist's skill development history", async () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/session/skills?therapistId=therapist-123',
      }

      const mockClient = await mockConnect()
      mockClient.query.mockResolvedValueOnce({
        rowCount: 2,
        rows: [
          {
            skill_name: 'Active Listening',
            skill_category: 'therapeutic',
            current_score: 85,
            practice_sessions: 5,
            last_practiced: '2025-01-01T10:00:00Z',
            created_at: '2025-01-01T09:00:00Z',
          },
          {
            skill_name: 'Empathy',
            skill_category: 'therapeutic',
            current_score: 90,
            practice_sessions: 3,
            last_practiced: '2025-01-02T10:00:00Z',
            created_at: '2025-01-02T09:00:00Z',
          },
        ],
      })

      const response = await GET(createGetContext(mockRequest.url))
      const responseBody = await parseResponseBody(
        response,
        hasTherapistSkillsResponse,
      )

      expect(response.status).toBe(200)
      expect(responseBody.therapistId).toBe('therapist-123')
      expect(responseBody.skills).toHaveLength(2)
      expect(responseBody?.skills[0].skill_name).toBe('Active Listening')
    })

    it('should return 400 for missing parameters', async () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/session/skills',
      }

      const response = await GET(createGetContext(mockRequest.url))
      const responseBody = await parseResponseBody(response, hasErrorResponse)

      expect(response.status).toBe(400)
      expect(responseBody.error).toBe(
        'Missing sessionId or therapistId parameter',
      )
    })

    it('should return 404 for session not found', async () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/session/skills?sessionId=non-existent-session',
      }

      const mockClient = await mockConnect()
      mockClient.query.mockResolvedValueOnce({ rowCount: 0 })

      const response = await GET(createGetContext(mockRequest.url))
      const responseBody = await parseResponseBody(response, hasErrorResponse)

      expect(response.status).toBe(404)
      expect(responseBody.error).toBe('Session not found')
    })

    it('should handle database errors', async () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/session/skills?sessionId=test-session-123',
      }

      const mockClient = await mockConnect()
      mockClient.query.mockRejectedValueOnce(new Error('Database error'))

      const response = await GET(createGetContext(mockRequest.url))
      const responseBody = await parseResponseBody(response, hasErrorResponse)

      expect(response.status).toBe(500)
      expect(responseBody.error).toBe('Internal server error')
    })
  })
})
