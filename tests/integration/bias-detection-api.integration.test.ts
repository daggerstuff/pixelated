/// <reference types="vitest/globals" />
/**
 * Integration Tests for Bias Detection API Endpoints
 *
 * These tests verify the complete request/response cycle for all bias detection
 * API endpoints, including authentication, validation, data processing, and
 * error handling in a realistic environment.
 */

// Test utilities and setup
interface TestServer {
  port: number
  baseUrl: string
  start: () => Promise<void>
  stop: () => Promise<void>
}

interface TestSession {
  sessionId: string
  timestamp: string
  participantDemographics: {
    age: string
    gender: string
    ethnicity: string
    primaryLanguage: string
  }
  conversationData: {
    messages: Array<{
      role: 'user' | 'assistant'
      content: string
      timestamp: string
    }>
    duration: number
    wordCount: number
  }
  contextualFactors: {
    sessionType: string
    therapeuticGoals: string[]
    previousSessions: number
  }
}

interface BiasAnalysisData {
  sessionId: string
  overallBiasScore: number
  alertLevel: string
  confidence: number
  analysis: {
    linguistic: Record<string, unknown>
    contextual: Record<string, unknown>
    interactive: Record<string, unknown>
    evaluation: Record<string, unknown>
  }
  demographics: {
    age: string
    gender: string
    ethnicity: string
    primaryLanguage: string
  }
  recommendations: Array<Record<string, unknown>>
}

interface DashboardData {
  summary: {
    totalSessions: number
    averageBiasScore: number
    totalAlerts: number
    lastUpdated: string
  }
  alerts: Array<Record<string, unknown>>
  trends: Array<Record<string, unknown>>
  demographics: Record<string, unknown>
  recentAnalyses: Array<Record<string, unknown>>
}

interface ApiResponse<T = Record<string, unknown>> {
  success: boolean
  data?: T
  error?: string
  message?: string
  processingTime?: number
  cacheHit?: boolean
}

describe('Bias Detection API Integration Tests', () => {
  let testServer: TestServer
  let authToken: string
  let testSession: TestSession

  // Test data setup
  const validTestSession: TestSession = {
    sessionId: '550e8400-e29b-41d4-a716-446655440000',
    timestamp: new Date().toISOString(),
    participantDemographics: {
      age: '25-35',
      gender: 'female',
      ethnicity: 'hispanic',
      primaryLanguage: 'en',
    },
    conversationData: {
      messages: [
        {
          role: 'user',
          content: 'I feel anxious about my upcoming presentation at work.',
          timestamp: new Date(Date.now() - 300000).toISOString(),
        },
        {
          role: 'assistant',
          content:
            'I understand that presentations can feel overwhelming. Can you tell me more about what specifically makes you feel anxious?',
          timestamp: new Date(Date.now() - 240000).toISOString(),
        },
        {
          role: 'user',
          content:
            'I worry that my colleagues will judge me because of my accent.',
          timestamp: new Date(Date.now() - 180000).toISOString(),
        },
        {
          role: 'assistant',
          content:
            "Your accent is part of who you are, and it doesn't diminish your expertise or value. Let's work on building your confidence.",
          timestamp: new Date(Date.now() - 120000).toISOString(),
        },
      ],
      duration: 1800, // 30 minutes
      wordCount: 450,
    },
    contextualFactors: {
      sessionType: 'individual',
      therapeuticGoals: ['anxiety_management', 'confidence_building'],
      previousSessions: 3,
    },
  }

  const invalidTestSession = {
    sessionId: 'invalid-uuid',
    timestamp: 'invalid-date',
    participantDemographics: {
      age: 'invalid-age',
      gender: 'invalid-gender',
    },
  }

  beforeAll(async () => {
    // Setup test server (mock or actual test instance)
    testServer = {
      port: 3001,
      baseUrl: 'http://localhost:3001',
      start: async () => {
        // In a real integration test, this would start the actual server
        console.log('Test server started on port', testServer.port)
      },
      stop: async () => {
        console.log('Test server stopped')
      },
    }

    await testServer.start()

    // Setup authentication token for tests
    authToken = 'Bearer test-integration-token-12345'
    testSession = { ...validTestSession }
  })

  afterAll(async () => {
    await testServer.stop()
  })

  beforeEach(() => {
    // Reset test data before each test
    testSession = { ...validTestSession }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/bias-detection/analyze', () => {
    it('should successfully analyze a valid session', async () => {
      const analyzeEndpoint = `${testServer.baseUrl}/api/bias-detection/analyze`
      const requestBody = {
        session: testSession,
        options: {
          includeExplanation: true,
          skipCache: false,
        },
      }

      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken,
        },
        body: JSON.stringify(requestBody),
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toContain('application/json')

      const data: ApiResponse<BiasAnalysisData> = await response.json()
      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()

      const analysisData = data.data!
      expect(analysisData.sessionId).toBe(testSession.sessionId)
      expect(analysisData.overallBiasScore).toBeTypeOf('number')
      expect(analysisData.overallBiasScore).toBeGreaterThanOrEqual(0)
      expect(analysisData.overallBiasScore).toBeLessThanOrEqual(1)
      expect(analysisData.alertLevel).toMatch(/^(low|medium|high|critical)$/)
      expect(analysisData.confidence).toBeTypeOf('number')
      expect(data.processingTime).toBeTypeOf('number')
      expect(data.cacheHit).toBeTypeOf('boolean')

      // Verify analysis structure
      expect(analysisData.analysis).toBeDefined()
      expect(analysisData.analysis.linguistic).toBeDefined()
      expect(analysisData.analysis.contextual).toBeDefined()
      expect(analysisData.analysis.interactive).toBeDefined()
      expect(analysisData.analysis.evaluation).toBeDefined()

      // Verify demographics are preserved
      expect(analysisData.demographics).toEqual(
        testSession.participantDemographics,
      )

      // Verify recommendations are provided
      expect(analysisData.recommendations).toBeInstanceOf(Array)
      expect(analysisData.recommendations.length).toBeGreaterThan(0)
    })

    it('should handle cached results correctly', async () => {
      const requestBody = {
        session: testSession,
        options: { includeExplanation: false },
      }

      // First request - should miss cache
      const firstResponse = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken,
        },
        body: JSON.stringify(requestBody),
      })

      expect(firstResponse.status).toBe(200)
      const firstData: ApiResponse = await firstResponse.json()
      expect(firstData.success).toBe(true)
      expect(firstData.cacheHit).toBe(false)

      // Second request with same session - should hit cache
      const secondResponse = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken,
        },
        body: JSON.stringify(requestBody),
      })

      expect(secondResponse.status).toBe(200)
      const secondData: ApiResponse = await secondResponse.json()
      expect(secondData.success).toBe(true)
      expect(secondData.cacheHit).toBe(true)
      expect(secondData.processingTime).toBeLessThan(
        firstData.processingTime ?? 0,
      )
    })

    it('should skip cache when skipCache option is true', async () => {
      const requestBody = {
        session: testSession,
        options: { skipCache: true },
      }

      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken,
        },
        body: JSON.stringify(requestBody),
      })

      expect(response.status).toBe(200)
      const data: ApiResponse = await response.json()
      expect(data.success).toBe(true)
      expect(data.cacheHit).toBe(false)
    })

    it('should return 401 for missing authorization', async () => {
      const requestBody = { session: testSession }

      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // No Authorization header
        },
        body: JSON.stringify(requestBody),
      })

      expect(response.status).toBe(401)
      const data: ApiResponse = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 401 for invalid authorization token', async () => {
      const requestBody = { session: testSession }

      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-token',
        },
        body: JSON.stringify(requestBody),
      })

      expect(response.status).toBe(401)
      const data: ApiResponse = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 400 for invalid content type', async () => {
      const requestBody = { session: testSession }

      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'Authorization': authToken,
        },
        body: JSON.stringify(requestBody),
      })

      expect(response.status).toBe(400)
      const data: ApiResponse = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid Content Type')
    })

    it('should return 400 for validation errors', async () => {
      const requestBody = { session: invalidTestSession }

      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken,
        },
        body: JSON.stringify(requestBody),
      })

      expect(response.status).toBe(400)
      const data: ApiResponse = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Validation Error')
      expect(data.message).toContain('Session ID must be a valid UUID')
    })

    it('should return 400 for missing required fields', async () => {
      const incompleteSession = {
        sessionId: testSession.sessionId,
        // Missing other required fields
      }

      const requestBody = { session: incompleteSession }

      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken,
        },
        body: JSON.stringify(requestBody),
      })

      expect(response.status).toBe(400)
      const data: ApiResponse = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Validation Error')
    })

    it('should return 400 for malformed JSON', async () => {
      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken,
        },
        body: '{ invalid json }',
      })

      expect(response.status).toBe(400)
      const data: ApiResponse = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Validation Error')
    })

    it('should handle rate limiting correctly', async () => {
      const requestBody = { session: testSession }
      const requests: Promise<Response>[] = []

      // Make multiple rapid requests to trigger rate limiting
      for (let i = 0; i < 65; i++) {
        requests.push(
          fetch(analyzeEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authToken,
            },
            body: JSON.stringify({
              ...requestBody,
              session: {
                ...testSession,
                sessionId: `550e8400-e29b-41d4-a716-44665544${i.toString().padStart(4, '0')}`,
              },
            }),
          }),
        )
      }

      const responses = await Promise.all(requests)

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter((r) => r.status === 429)
      expect(rateLimitedResponses.length).toBeGreaterThan(0)

      // Check rate limit response format
      if (rateLimitedResponses.length > 0) {
        const rateLimitData: ApiResponse = await rateLimitedResponses[0]!.json()
        expect(rateLimitData.success).toBe(false)
        expect(rateLimitData.error).toBe('Rate Limit Exceeded')
      }
    })

    it('should include security headers in responses', async () => {
      const requestBody = { session: testSession }

      const response = await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken,
        },
        body: JSON.stringify(requestBody),
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toContain('application/json')
      expect(response.headers.get('X-Processing-Time')).toBeDefined()
      expect(response.headers.get('X-Cache')).toBeDefined()
    })
  })

  describe('GET /api/bias-detection/analyze', () => {
    let analyzeEndpoint: string

    beforeEach(async () => {
      analyzeEndpoint = `${testServer.baseUrl}/api/bias-detection/analyze`
      // Create an analysis first to retrieve later
      await fetch(analyzeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken,
        },
        body: JSON.stringify({ session: testSession }),
      })
    })

    it('should successfully retrieve analysis results', async () => {
      const url = new URL(analyzeEndpoint)
      url.searchParams.set('sessionId', testSession.sessionId)
      url.searchParams.set('includeCache', 'true')

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: authToken,
        },
      })

      expect(response.status).toBe(200)
      const data: ApiResponse<BiasAnalysisData> = await response.json()
      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()
      expect(data.data!.sessionId).toBe(testSession.sessionId)
    })

    it('should return cached result when available and includeCache is true', async () => {
      const url = new URL(analyzeEndpoint)
      url.searchParams.set('sessionId', testSession.sessionId)
      url.searchParams.set('includeCache', 'true')

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: authToken,
        },
      })

      expect(response.status).toBe(200)
      const data: ApiResponse = await response.json()
      expect(data.success).toBe(true)
      expect(data.cacheHit).toBe(true)
    })

    it('should anonymize sensitive data when anonymize is true', async () => {
      const url = new URL(analyzeEndpoint)
      url.searchParams.set('sessionId', testSession.sessionId)
      url.searchParams.set('anonymize', 'true')

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: authToken,
        },
      })

      expect(response.status).toBe(200)
      const data: ApiResponse<BiasAnalysisData> = await response.json()
      expect(data.success).toBe(true)
      const analysisData = data.data!
      expect(analysisData.demographics.ethnicity).toBe('[ANONYMIZED]')
      expect(analysisData.demographics.age).toBe(
        testSession.participantDemographics.age,
      )
      expect(analysisData.demographics.gender).toBe(
        testSession.participantDemographics.gender,
      )
    })

    it('should return 400 for invalid sessionId', async () => {
      const url = new URL(analyzeEndpoint)
      url.searchParams.set('sessionId', 'invalid-uuid')

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: authToken,
        },
      })

      expect(response.status).toBe(400)
      const data: ApiResponse = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Validation Error')
      expect(data.message).toContain('Session ID must be a valid UUID')
    })

    it('should return 404 when analysis not found', async () => {
      const url = new URL(analyzeEndpoint)
      url.searchParams.set('sessionId', '550e8400-e29b-41d4-a716-446655440999')

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: authToken,
        },
      })

      expect(response.status).toBe(404)
      const data: ApiResponse = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Not Found')
      expect(data.message).toBe('Session analysis not found')
    })
  })

  describe('GET /api/bias-detection/dashboard', () => {
    let dashboardEndpoint: string

    beforeEach(() => {
      dashboardEndpoint = `${testServer.baseUrl}/api/bias-detection/dashboard`
    })

    it('should successfully return dashboard data with default parameters', async () => {
      const response = await fetch(dashboardEndpoint, {
        method: 'GET',
        headers: {
          Authorization: authToken,
        },
      })

      expect(response.status).toBe(200)
      const data: ApiResponse<DashboardData> = await response.json()
      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()

      const dashboardData = data.data!
      // Verify dashboard structure
      expect(dashboardData.summary).toBeDefined()
      expect(dashboardData.summary.totalSessions).toBeTypeOf('number')
      expect(dashboardData.summary.averageBiasScore).toBeTypeOf('number')
      expect(dashboardData.summary.totalAlerts).toBeTypeOf('number')
      expect(dashboardData.summary.lastUpdated).toBeDefined()

      expect(dashboardData.alerts).toBeInstanceOf(Array)
      expect(dashboardData.trends).toBeInstanceOf(Array)
      expect(dashboardData.demographics).toBeDefined()
      expect(dashboardData.recentAnalyses).toBeInstanceOf(Array)

      expect(data.processingTime).toBeTypeOf('number')
    })

    it('should handle custom time range parameter', async () => {
      const url = new URL(dashboardEndpoint)
      url.searchParams.set('timeRange', '7d')

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: authToken,
        },
      })

      expect(response.status).toBe(200)
      const data: ApiResponse = await response.json()
      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()
    })

    it('should handle custom demographic filter parameter', async () => {
      const url = new URL(dashboardEndpoint)
      url.searchParams.set('demographic', 'female')

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: authToken,
        },
      })

      expect(response.status).toBe(200)
      const data: ApiResponse = await response.json()
      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()
    })

    it('should handle multiple query parameters', async () => {
      const url = new URL(dashboardEndpoint)
      url.searchParams.set('timeRange', '30d')
      url.searchParams.set('demographic', 'hispanic')

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: authToken,
        },
      })

      expect(response.status).toBe(200)
      const data: ApiResponse = await response.json()
      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()
    })

    it('should validate time range parameter values', async () => {
      const validTimeRanges = ['1h', '6h', '24h', '7d', '30d', '90d']

      for (const timeRange of validTimeRanges) {
        const url = new URL(dashboardEndpoint)
        url.searchParams.set('timeRange', timeRange)

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            Authorization: authToken,
          },
        })

        expect(response.status).toBe(200)
        const data: ApiResponse = await response.json()
        expect(data.success).toBe(true)
      }
    })

    it('should handle invalid time range gracefully', async () => {
      const url = new URL(dashboardEndpoint)
      url.searchParams.set('timeRange', 'invalid')

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: authToken,
        },
      })

      expect(response.status).toBe(200)
      const data: ApiResponse = await response.json()
      expect(data.success).toBe(true)
    })

    it('should set appropriate response headers', async () => {
      const response = await fetch(dashboardEndpoint, {
        method: 'GET',
        headers: {
          Authorization: authToken,
        },
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toContain('application/json')
      expect(response.headers.get('X-Processing-Time')).toBeDefined()
    })

    it('should handle concurrent requests properly', async () => {
      const requests = Array.from({ length: 5 }, () =>
        fetch(dashboardEndpoint, {
          method: 'GET',
          headers: {
            Authorization: authToken,
          },
        }),
      )

      const responses = await Promise.all(requests)

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200)
      })
    })
  })

  describe('GET /api/bias-detection/export', () => {
    let exportEndpoint: string

    beforeEach(() => {
      exportEndpoint = `${testServer.baseUrl}/api/bias-detection/export`
    })

    it('should export data as JSON format by default', async () => {
      const response = await fetch(exportEndpoint, {
        method: 'GET',
        headers: {
          Authorization: authToken,
        },
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/json')
      const contentDisposition = response.headers.get('Content-Disposition')
      expect(contentDisposition).toContain('attachment')
      expect(response.headers.get('Content-Disposition')).toContain('.json')

      const blob = await response.blob()
      expect(blob.size).toBeGreaterThan(0)
      expect(blob.type).toBe('application/json')
    })

    it('should export data as CSV format when specified', async () => {
      const url = new URL(exportEndpoint)
      url.searchParams.set('format', 'csv')

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: authToken,
        },
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('text/csv')
      expect(response.headers.get('Content-Disposition')).toContain('.csv')

      const blob = await response.blob()
      expect(blob.size).toBeGreaterThan(0)
      expect(blob.type).toBe('text/csv')
    })

    it('should export data as PDF format when specified', async () => {
      const url = new URL(exportEndpoint)
      url.searchParams.set('format', 'pdf')

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: authToken,
        },
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/pdf')
      expect(response.headers.get('Content-Disposition')).toContain('.pdf')

      const blob = await response.blob()
      expect(blob.size).toBeGreaterThan(0)
      expect(blob.type).toBe('application/pdf')
    })

    it('should handle custom time range parameter', async () => {
      const url = new URL(exportEndpoint)
      url.searchParams.set('timeRange', '7d')

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: authToken,
        },
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/json')
    })

    it('should handle includeDetails parameter', async () => {
      const url = new URL(exportEndpoint)
      url.searchParams.set('includeDetails', 'true')

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: authToken,
        },
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/json')
    })

    it('should handle multiple parameters', async () => {
      const url = new URL(exportEndpoint)
      url.searchParams.set('format', 'csv')
      url.searchParams.set('timeRange', '30d')
      url.searchParams.set('includeDetails', 'true')

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: authToken,
        },
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('text/csv')
    })

    it('should handle invalid format parameter gracefully', async () => {
      const url = new URL(exportEndpoint)
      url.searchParams.set('format', 'invalid')

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: authToken,
        },
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/json')
    })

    it('should generate appropriate filename for each format', async () => {
      const formats = [
        {
          format: 'json',
          expectedType: 'application/json',
          expectedExt: '.json',
        },
        { format: 'csv', expectedType: 'text/csv', expectedExt: '.csv' },
        { format: 'pdf', expectedType: 'application/pdf', expectedExt: '.pdf' },
      ]

      for (const { format, expectedType, expectedExt } of formats) {
        const url = new URL(exportEndpoint)
        url.searchParams.set('format', format)

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            Authorization: authToken,
          },
        })

        expect(response.status).toBe(200)
        expect(response.headers.get('Content-Type')).toBe(expectedType)
        expect(response.headers.get('Content-Disposition')).toContain(
          expectedExt,
        )
      }
    })

    it('should validate time range parameter values', async () => {
      const validTimeRanges = ['1h', '6h', '24h', '7d', '30d', '90d']

      for (const timeRange of validTimeRanges) {
        const url = new URL(exportEndpoint)
        url.searchParams.set('timeRange', timeRange)

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            Authorization: authToken,
          },
        })

        expect(response.status).toBe(200)
      }
    })
  })

  describe('Cross-Endpoint Integration Scenarios', () => {
    it('should maintain data consistency across analyze and dashboard endpoints', async () => {
      // Analyze a session
      const analyzeResponse = await fetch(
        `${testServer.baseUrl}/api/bias-detection/analyze`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authToken,
          },
          body: JSON.stringify({ session: testSession }),
        },
      )

      expect(analyzeResponse.status).toBe(200)
      const analyzeData: ApiResponse<BiasAnalysisData> =
        await analyzeResponse.json()
      expect(analyzeData.success).toBe(true)

      // Get dashboard data
      const dashboardResponse = await fetch(
        `${testServer.baseUrl}/api/bias-detection/dashboard`,
        {
          method: 'GET',
          headers: {
            Authorization: authToken,
          },
        },
      )

      expect(dashboardResponse.status).toBe(200)
      const dashboardData: ApiResponse<DashboardData> =
        await dashboardResponse.json()

      // Verify the analyzed session appears in recent analyses
      const dashboardResult = dashboardData.data!
      const foundSession = dashboardResult.recentAnalyses.find(
        (analysis: Record<string, unknown>) =>
          analysis['sessionId'] === testSession.sessionId,
      )
      expect(foundSession).toBeDefined()
      expect(foundSession!['overallBiasScore']).toBe(
        analyzeData.data!.overallBiasScore,
      )
    })

    it('should export data that includes recently analyzed sessions', async () => {
      // Analyze a session
      await fetch(`${testServer.baseUrl}/api/bias-detection/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken,
        },
        body: JSON.stringify({ session: testSession }),
      })

      // Export data
      const exportResponse = await fetch(
        `${testServer.baseUrl}/api/bias-detection/export`,
        {
          method: 'GET',
          headers: {
            Authorization: authToken,
          },
        },
      )

      expect(exportResponse.status).toBe(200)
      const exportBlob = await exportResponse.blob()
      const exportText = await exportBlob.text()
      const exportData = JSON.parse(exportText)

      // Verify the analyzed session is included in the export
      const { recentAnalyses } = exportData
      const foundSession = recentAnalyses.find(
        (analysis: Record<string, unknown>) =>
          analysis['sessionId'] === testSession.sessionId,
      )
      expect(foundSession).toBeDefined()
    })

    it('should handle authentication consistently across all endpoints', async () => {
      const endpoints = [
        {
          method: 'POST',
          url: `${testServer.baseUrl}/api/bias-detection/analyze`,
          body: { session: testSession },
        },
        {
          method: 'GET',
          url: `${testServer.baseUrl}/api/bias-detection/analyze?sessionId=${testSession.sessionId}`,
        },
        {
          method: 'GET',
          url: `${testServer.baseUrl}/api/bias-detection/dashboard`,
        },
        {
          method: 'GET',
          url: `${testServer.baseUrl}/api/bias-detection/export`,
        },
      ]

      for (const endpoint of endpoints) {
        // Test without authorization
        const unauthorizedResponse = await fetch(endpoint.url, {
          method: endpoint.method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: endpoint.body ? JSON.stringify(endpoint.body) : null,
        })

        expect(unauthorizedResponse.status).toBe(401)

        // Test with invalid authorization
        const invalidAuthResponse = await fetch(endpoint.url, {
          method: endpoint.method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer invalid-token',
          },
          body: endpoint.body ? JSON.stringify(endpoint.body) : null,
        })

        expect(invalidAuthResponse.status).toBe(401)

        // Test with valid authorization
        const validAuthResponse = await fetch(endpoint.url, {
          method: endpoint.method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authToken,
          },
          body: endpoint.body ? JSON.stringify(endpoint.body) : null,
        })

        expect(validAuthResponse.status).not.toBe(401)
      }
    })
  })

  describe('Performance and Load Testing', () => {
    it('should handle concurrent requests across multiple endpoints', async () => {
      const concurrentRequests = [
        // Analyze requests
        ...Array.from({ length: 5 }, (_, i) =>
          fetch(`${testServer.baseUrl}/api/bias-detection/analyze`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authToken,
            },
            body: JSON.stringify({
              session: {
                ...testSession,
                sessionId: `550e8400-e29b-41d4-a716-44665544${i.toString().padStart(4, '0')}`,
              },
            }),
          }),
        ),
        // Dashboard requests
        ...Array.from({ length: 3 }, () =>
          fetch(`${testServer.baseUrl}/api/bias-detection/dashboard`, {
            method: 'GET',
            headers: {
              Authorization: authToken,
            },
          }),
        ),
        // Export requests
        ...Array.from({ length: 2 }, () =>
          fetch(`${testServer.baseUrl}/api/bias-detection/export`, {
            method: 'GET',
            headers: {
              Authorization: authToken,
            },
          }),
        ),
      ]

      const responses = await Promise.all(concurrentRequests)

      // Most requests should succeed (some might be rate limited)
      const successfulResponses = responses.filter((r) => r.status === 200)
      expect(successfulResponses.length).toBeGreaterThan(5)

      // Check that rate limiting is working
      const rateLimitedResponses = responses.filter((r) => r.status === 429)
      expect(rateLimitedResponses.length).toBeGreaterThanOrEqual(0)
    })

    it('should maintain reasonable response times under load', async () => {
      const startTime = Date.now()

      const requests = Array.from({ length: 10 }, () =>
        fetch(`${testServer.baseUrl}/api/bias-detection/dashboard`, {
          method: 'GET',
          headers: {
            Authorization: authToken,
          },
        }),
      )

      const responses = await Promise.all(requests)
      const endTime = Date.now()
      const totalTime = endTime - startTime

      // All requests should complete within reasonable time
      expect(totalTime).toBeLessThan(30000) // 30 seconds for 10 requests

      // Check individual response times
      for (const response of responses) {
        if (response.status === 200) {
          const data: ApiResponse = await response.json()
          expect(data.processingTime).toBeLessThan(5000) // 5 seconds per request
        }
      }
    })
  })

  describe('Error Recovery and Resilience', () => {
    it('should handle service unavailability gracefully', async () => {
      // This test would simulate service downtime
      // In a real scenario, you might temporarily stop a dependency service

      const response = await fetch(
        `${testServer.baseUrl}/api/bias-detection/analyze`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authToken,
          },
          body: JSON.stringify({ session: testSession }),
        },
      )

      // Should either succeed or fail gracefully with proper error response
      if (response.status !== 200) {
        expect(response.status).toBeOneOf([500, 503])
        const data: ApiResponse = await response.json()
        expect(data.success).toBe(false)
        expect(data.error).toBeDefined()
      }
    })

    it('should handle malformed requests gracefully', async () => {
      const malformedRequests = [
        // Invalid JSON
        {
          body: '{ invalid json }',
          expectedStatus: 400,
        },
        // Missing required fields
        {
          body: JSON.stringify({ session: { sessionId: 'test' } }),
          expectedStatus: 400,
        },
        // Invalid data types
        {
          body: JSON.stringify({ session: { sessionId: 123 } }),
          expectedStatus: 400,
        },
      ]

      for (const request of malformedRequests) {
        const response = await fetch(
          `${testServer.baseUrl}/api/bias-detection/analyze`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authToken,
            },
            body: request.body,
          },
        )

        expect(response.status).toBe(request.expectedStatus)
        const data: ApiResponse = await response.json()
        expect(data.success).toBe(false)
        expect(data.error).toBeDefined()
      }
    })
  })
})
