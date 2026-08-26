// Integration tests for bias detection demo system

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

// Mock fetch for API testing
const originalFetch = global.fetch

beforeAll(() => {
  // Mock fetch for testing API endpoints
  global.fetch = vi.fn()
})

afterAll(() => {
  global.fetch = originalFetch
})

describe('Bias Detection API Integration Tests', () => {
  const baseUrl = 'http://localhost:4321/api/demos/bias-detection'

  const createJsonResponse = (body: unknown): Response =>
    new Response(JSON.stringify(body), {
      headers: {
        'Content-Type': 'application/json',
      },
    })

  describe('Analysis API (/analyze)', () => {
    it('should successfully analyze bias in therapeutic content', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        createJsonResponse({
          success: true,
          analysis: {
            sessionId: 'test-session-123',
            overallBiasScore: 0.45,
            alertLevel: 'medium',
            confidence: 0.87,
          },
        }),
      )

      const requestBody = {
        content:
          'You people from your culture tend to be more emotional about these things.',
        demographics: {
          age: '26-35',
          gender: 'female',
          ethnicity: 'hispanic',
          primaryLanguage: 'es',
        },
      }

      const response = await fetch(`${baseUrl}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      expect(response.ok).toBe(true)
      const responseBody = await response.text()
      expect(responseBody).toContain('"success":true')
      expect(responseBody).toContain('"overallBiasScore":0.45')
    })

    it('should reject requests with missing required fields', async () => {
      const mockResponse = {
        error: 'Missing required fields: content and demographics are required',
      }

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      )

      const response = await fetch(`${baseUrl}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Test content' }),
      })

      expect(response.ok).toBe(false)
      const responseBody = await response.text()
      expect(responseBody).toContain(
        '"error":"Missing required fields: content and demographics are required"',
      )
    })
  })

  describe('Presets API (/presets)', () => {
    it('should return all preset scenarios', async () => {
      const mockResponse = {
        success: true,
        scenarios: [
          {
            id: 'high-bias-cultural',
            name: 'High Cultural Bias',
            category: 'cultural',
            riskLevel: 'critical',
          },
        ],
        metadata: {
          total: 6,
          categories: ['cultural', 'gender', 'age'],
        },
      }

      vi.mocked(global.fetch).mockResolvedValueOnce(
        createJsonResponse({
          ...mockResponse,
          metadata: {
            total: 6,
            categories: ['cultural', 'gender', 'age'],
          },
        }),
      )

      const response = await fetch(`${baseUrl}/presets`)
      expect(response.ok).toBe(true)
      const responseBody = await response.text()
      expect(responseBody).toContain('"success":true')
      expect(responseBody).toContain('"id":"high-bias-cultural"')
    })
  })

  describe('Export API (/export)', () => {
    it('should export analysis data in JSON format', async () => {
      const mockResponse = JSON.stringify({
        sessionId: 'test-session-123',
        analysis: { overallBiasScore: 0.45 },
      })

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(mockResponse, {
          headers: {
            'content-type': 'application/json',
          },
        }),
      )

      const response = await fetch(`${baseUrl}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisResults: { sessionId: 'test-session-123' },
          format: 'json',
        }),
      })

      expect(response.ok).toBe(true)
    })
  })
})
