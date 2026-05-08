import { describe, it, expect } from 'vitest'

import {
  parseJsonSafely,
  validateAnalysisResults,
  validateCrisisDetectionResponse,
  parseApiResponse,
} from './json-validator'

describe('json-validator', () => {
  describe('parseJsonSafely', () => {
    it('returns error for invalid JSON', () => {
      const result = parseJsonSafely('invalid json', () => ({
        success: true,
        data: {},
      }))
      expect(result.success).toBe(false)
    })
  })

  describe('validateAnalysisResults', () => {
    it('validates a correct object', () => {
      const valid = {
        entities: [{ text: 'a', type: 'b', confidence: 0.9 }],
        concepts: [{ concept: 'x', relevance: 0.5 }],
        riskFactors: [{ factor: 'y', severity: 'Low' }],
      }
      expect(validateAnalysisResults(valid).success).toBe(true)
    })

    it('returns error for invalid object', () => {
      expect(validateAnalysisResults(null).success).toBe(false)
      expect(validateAnalysisResults({}).success).toBe(false)
    })
  })

  describe('parseApiResponse', () => {
    it('returns error for non-ok response', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response
      const result = await parseApiResponse(mockResponse, () => ({
        success: true,
        data: {},
      }))
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('HTTP 404: Not Found')
      }
    })

    it('returns error for empty body', async () => {
      const mockResponse = {
        ok: true,
        text: async () => '  ',
      } as Response
      const result = await parseApiResponse(mockResponse, () => ({
        success: true,
        data: {},
      }))
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Empty response body')
      }
    })
  })
})
