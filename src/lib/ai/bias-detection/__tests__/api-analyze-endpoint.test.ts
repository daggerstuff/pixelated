import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { createMocks } from 'node-mocks-http'
import { POST, GET } from './analyze'
import { MockDataGenerator, TestUtils } from '@/lib/testing/test-helpers'

// Mock database connection
jest.mock('@/lib/db', () => ({
  query: jest.fn(),
  getClient: jest.fn(() => ({
    query: jest.fn(),
    release: jest.fn()
  }))
}))

// Mock security middleware
jest.mock('@/middleware/security', () => ({
  securityMiddleware: jest.fn((req, res, next) => next())
}))

// Mock logging
jest.mock('@/lib/logging/standardized-logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}))

describe('/api/bias-analysis/analyze', () => {
  let mockDb: any

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      getClient: jest.fn(() => ({
        query: jest.fn(),
        release: jest.fn()
      }))
    }

    // Reset all mocks
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('POST /api/bias-analysis/analyze', () => {
    it('should successfully analyze bias with valid input', async () => {
      const mockAnalysis = MockDataGenerator.generateBiasAnalysis({
        overallBiasScore: 0.23,
        alertLevel: 'low',
        confidence: 0.89
      })

      // Mock successful database operations
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'analysis-123' }] }) // INSERT analysis
        .mockResolvedValueOnce({ rows: [{ id: 'keyword-123' }] }) // INSERT keyword analysis
        .mockResolvedValueOnce({ rows: [{ id: 'sentiment-123' }] }) // INSERT sentiment analysis
        .mockResolvedValueOnce({ rows: [{ id: 'contextual-123' }] }) // INSERT contextual analysis

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          text: 'Therapist: How are you feeling today? Patient: I feel anxious about my job interview.',
          context: 'Therapeutic session analysis',
          demographics: {
            age: '25-34',
            gender: 'female',
            ethnicity: 'hispanic',
            primaryLanguage: 'en'
          },
          sessionType: 'anxiety-treatment',
          therapistNotes: 'Initial assessment session'
        }
      })

      await POST({ request: req })

      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('analysis')
      expect(responseData.analysis).toHaveProperty('overallBiasScore')
      expect(responseData.analysis).toHaveProperty('alertLevel')
      expect(responseData.analysis).toHaveProperty('confidence')
      expect(responseData.analysis).toHaveProperty('layerResults')
      expect(responseData.analysis).toHaveProperty('recommendations')
    })

    it('should handle missing required fields', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          // Missing required text field
          context: 'Therapeutic session analysis'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error')
      expect(responseData.error).toContain('Missing required field')
    })

    it('should handle empty text input', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          text: '',
          context: 'Therapeutic session analysis'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error')
      expect(responseData.error).toContain('Text content is required')
    })

    it('should handle very long text input', async () => {
      const longText = 'a'.repeat(100000) // 100KB of text

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          text: longText,
          context: 'Therapeutic session analysis'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error')
      expect(responseData.error).toContain('Text content too long')
    })

    it('should handle database connection errors', async () => {
      // Mock database connection failure
      mockDb.query.mockRejectedValue(new Error('Database connection failed'))

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          text: 'Therapist: How are you feeling today?',
          context: 'Therapeutic session analysis'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(500)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error')
      expect(responseData.error).toContain('Database error')
    })

    it('should handle malformed JSON input', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{ invalid json }'
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error')
    })

    it('should handle concurrent requests properly', async () => {
      const mockAnalysis = MockDataGenerator.generateBiasAnalysis()

      // Mock successful database operations
      mockDb.query.mockResolvedValue({ rows: [{ id: TestUtils.generateRandomId() }] })

      const requests = []
      for (let i = 0; i < 5; i++) {
        const { req, res } = createMocks({
          method: 'POST',
          body: {
            text: `Therapist session text ${i}`,
            context: 'Concurrent test session'
          }
        })
        requests.push(handler(req, res))
      }

      const results = await Promise.all(requests)

      // All requests should succeed
      results.forEach(result => {
        expect(result).toBeDefined()
      })
    })

    it('should validate demographics data structure', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          text: 'Therapist: How are you feeling today?',
          context: 'Therapeutic session analysis',
          demographics: {
            age: 'invalid-age',
            gender: 'invalid-gender',
            ethnicity: 'invalid-ethnicity',
            primaryLanguage: 'invalid-language'
          }
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error')
      expect(responseData.error).toContain('Invalid demographics')
    })

    it('should handle special characters in text', async () => {
      const specialText = 'Thérapist: Hów àre yôu féeling? Pätient: I\'m ñot sûré... 😊'

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          text: specialText,
          context: 'Therapeutic session with special characters'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('analysis')
    })

    it('should handle HTML content in text input', async () => {
      const htmlText = '<p>Therapist: How are you feeling today?</p><script>alert("test")</script>'

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          text: htmlText,
          context: 'Therapeutic session with HTML content'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('analysis')
      // Should sanitize HTML content
      expect(responseData.analysis.sanitizedText).toBeDefined()
    })
  })

  describe('GET /api/bias-analysis/analyze', () => {
    it('should return API statistics', async () => {
      // Mock database query for statistics
      mockDb.query.mockResolvedValue({
        rows: [{
          total_analyses: 150,
          avg_bias_score: 0.23,
          avg_confidence: 0.87,
          total_processing_time: 187500,
          last_analysis_at: new Date()
        }]
      })

      const { req, res } = createMocks({
        method: 'GET'
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('statistics')
      expect(responseData.statistics).toHaveProperty('totalAnalyses', 150)
      expect(responseData.statistics).toHaveProperty('averageBiasScore', 0.23)
      expect(responseData.statistics).toHaveProperty('averageConfidence', 0.87)
    })

    it('should handle database errors for statistics', async () => {
      mockDb.query.mockRejectedValue(new Error('Statistics query failed'))

      const { req, res } = createMocks({
        method: 'GET'
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(500)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error')
    })
  })

  describe('Error Handling', () => {
    it('should handle unsupported HTTP methods', async () => {
      const { req, res } = createMocks({
        method: 'PUT'
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(405)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error')
      expect(responseData.error).toContain('Method not allowed')
    })

    it('should handle malformed request body', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: null
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error')
    })

    it('should handle extremely large request payloads', async () => {
      const largePayload = { text: 'x'.repeat(1000000) } // 1MB payload

      const { req, res } = createMocks({
        method: 'POST',
        body: largePayload
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(413)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error')
      expect(responseData.error).toContain('Payload too large')
    })
  })

  describe('Performance Tests', () => {
    it('should complete analysis within acceptable time limits', async () => {
      const startTime = Date.now()

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          text: 'Therapist: How are you feeling today? Patient: I feel anxious.',
          context: 'Performance test session'
        }
      })

      await handler(req, res)

      const endTime = Date.now()
      const responseTime = endTime - startTime

      expect(responseTime).toBeLessThan(5000) // Should complete within 5 seconds
      expect(res._getStatusCode()).toBe(200)
    })

    it('should handle multiple rapid requests', async () => {
      const promises = []

      for (let i = 0; i < 10; i++) {
        const { req, res } = createMocks({
          method: 'POST',
          body: {
            text: `Test session ${i}`,
            context: 'Rapid request test'
          }
        })
        promises.push(handler(req, res))
      }

      const results = await Promise.all(promises)

      results.forEach(result => {
        expect(result).toBeDefined()
      })
    })
  })

  describe('Security Tests', () => {
    it('should sanitize XSS attempts in input', async () => {
      const xssPayload = '<script>alert("XSS")</script>Therapist: How are you feeling?'

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          text: xssPayload,
          context: 'Security test session'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())

      // Response should not contain the script tag
      expect(res._getData()).not.toContain('<script>')
      expect(responseData).toHaveProperty('analysis')
    })

    it('should handle SQL injection attempts', async () => {
      const sqlInjectionPayload = "'; DROP TABLE bias_analyses; --"

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          text: sqlInjectionPayload,
          context: 'Security test session'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('analysis')
    })

    it('should validate input length limits', async () => {
      const extremelyLongText = 'word '.repeat(10000) // Very long text

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          text: extremelyLongText,
          context: 'Length validation test'
        }
      })

      await handler(req, res)

      // Should either succeed with truncated content or fail gracefully
      expect([200, 400]).toContain(res._getStatusCode())
    })
  })

  describe('Integration Tests', () => {
    it('should persist analysis results to database', async () => {
      const mockAnalysisId = TestUtils.generateRandomId()

      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: mockAnalysisId }]
      })

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          text: 'Therapist: How are you feeling today?',
          context: 'Database integration test'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)
      expect(mockDb.query).toHaveBeenCalled()

      // Verify the analysis was inserted
      const insertCall = mockDb.query.mock.calls.find(call =>
        call[0].includes('INSERT INTO bias_analyses')
      )
      expect(insertCall).toBeDefined()
    })

    it('should handle database transaction rollbacks on errors', async () => {
      // Mock database error during insertion
      mockDb.query.mockRejectedValueOnce(new Error('Database constraint violation'))

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          text: 'Therapist: How are you feeling today?',
          context: 'Transaction rollback test'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(500)
      const responseData = JSON.parse(res._getData())
      expect(responseData).toHaveProperty('error')
    })
  })
})
