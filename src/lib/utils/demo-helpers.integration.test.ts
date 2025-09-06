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

  describe('Analysis API (/analyze)', () => {
    it('should successfully analyze bias in therapeutic content', async () => {
      const mockResponse = {
        success: true,
        analysis: {
          sessionId: 'test-session-123',
          overallBiasScore: 0.45,
          alertLevel: 'medium',
          confidence: 0.87,
        },
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

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

      const data = await response.json()

      expect(response.ok).toBe(true)
      expect(data.success).toBe(true)
      expect(data.analysis.overallBiasScore).toBeGreaterThan(0)
    })

    it('should reject requests with missing required fields', async () => {
      const mockResponse = {
        error: 'Missing required fields: content and demographics are required',
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => mockResponse,
      } as Response)

      const response = await fetch(`${baseUrl}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Test content' }),
      })

      const data = await response.json()

      expect(response.ok).toBe(false)
      expect(data.error).toContain('Missing required fields')
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

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const response = await fetch(`${baseUrl}/presets`)
      const data = await response.json()

      expect(response.ok).toBe(true)
      expect(data.success).toBe(true)
      expect(data.scenarios).toBeInstanceOf(Array)
    })
  })

  describe('Export API (/export)', () => {
    it('should export analysis data in JSON format', async () => {
      const mockResponse = JSON.stringify({
        sessionId: 'test-session-123',
        analysis: { overallBiasScore: 0.45 },
      })

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => mockResponse,
        headers: new Map([['content-type', 'application/json']]),
      } as Response)

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
