import {
  parseSemanticEvidenceResponse,
  validateEvidenceItem,
} from '../semanticEvidenceParser'

// Mock logger
vi.mock('@/lib/utils/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

describe('SemanticEvidenceParser', () => {
  describe('parseSemanticEvidenceResponse', () => {
    it('should handle valid JSON with proper schema', () => {
      const validResponse = JSON.stringify({
        evidence: [
          {
            text: 'I feel hopeless',
            confidence: 0.8,
            clinicalRelevance: 'significant',
            rationale: 'Indicates depressive mood',
            category: 'depression_symptom',
          },
          {
            text: "Can't sleep at night",
            confidence: 0.7,
            clinicalRelevance: 'supportive',
            rationale: 'Sleep disturbance pattern',
            category: 'insomnia',
          },
        ],
      })

      const result = parseSemanticEvidenceResponse(validResponse)

      expect(result).toHaveLength(2)
      const firstItem = result[0]!
      expect(firstItem).toMatchObject({
        content: 'I feel hopeless',
        type: 'direct_quote',
        confidence: 0.8,
        severity: 'high',
        source: 'depression_symptom',
        clinicalRelevance: 0.75, // converted from 'significant'
      })
      expect(firstItem.context?.['semanticRationale']).toBe(
        'Indicates depressive mood',
      )
    })

    it('should handle invalid JSON gracefully', () => {
      const invalidJson = 'this is not valid json'
      const result = parseSemanticEvidenceResponse(invalidJson)
      expect(result).toEqual([])
    })

    it('should handle missing evidence array', () => {
      const responseWithoutEvidence = JSON.stringify({
        someOtherField: 'value',
      })
      const result = parseSemanticEvidenceResponse(responseWithoutEvidence)
      expect(result).toEqual([])
    })

    it('should handle evidence array with invalid items', () => {
      const responseWithInvalidItems = JSON.stringify({
        evidence: [
          {
            // Missing required text field
            confidence: 0.8,
            clinicalRelevance: 'significant',
          },
          {
            text: '', // Empty text should be filtered out
            confidence: 0.7,
          },
          {
            text: 'Valid evidence item',
            confidence: 0.9,
            clinicalRelevance: 'critical',
          },
        ],
      })

      const result = parseSemanticEvidenceResponse(responseWithInvalidItems)

      // Should only have the valid item
      expect(result).toHaveLength(1)
      const validItem = result[0]!
      expect(validItem.text).toBe('Valid evidence item')
    })

    it('should apply default values for optional fields', () => {
      const minimalResponse = JSON.stringify({
        evidence: [
          {
            text: 'Minimal evidence item',
          },
        ],
      })

      const result = parseSemanticEvidenceResponse(minimalResponse)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        text: 'Minimal evidence item',
        confidence: 0.5, // default value
        clinicalRelevance: 'supportive', // default value
        category: 'semantic_analysis', // default value
        relevance: 'medium', // computed from confidence
      })
    })

    it('should clamp confidence values to valid range', () => {
      const responseWithInvalidConfidence = JSON.stringify({
        evidence: [
          {
            text: 'High confidence item',
            confidence: 2.5, // Invalid: greater than 1
          },
          {
            text: 'Low confidence item',
            confidence: -0.5, // Invalid: less than 0
          },
        ],
      })

      const result = parseSemanticEvidenceResponse(
        responseWithInvalidConfidence,
      )

      expect(result).toHaveLength(2)
      const highConfidenceItem = result[0]!
      const lowConfidenceItem = result[1]!
      expect(highConfidenceItem.confidence).toBe(1) // Clamped to max
      expect(lowConfidenceItem.confidence).toBe(0) // Clamped to min
    })

    it('should validate clinical relevance enum values', () => {
      const responseWithInvalidClinicalRelevance = JSON.stringify({
        evidence: [
          {
            text: 'Evidence with invalid clinical relevance',
            clinicalRelevance: 'invalid_value',
          },
        ],
      })

      const result = parseSemanticEvidenceResponse(
        responseWithInvalidClinicalRelevance,
      )

      expect(result).toHaveLength(1)
      const evidenceItem = result[0]!
      expect(evidenceItem.clinicalRelevance).toBe('supportive') // Should default to 'supportive'
    })

    it('should trim whitespace from text fields', () => {
      const responseWithWhitespace = JSON.stringify({
        evidence: [
          {
            text: '   Evidence with whitespace   ',
            confidence: 0.8,
          },
        ],
      })

      const result = parseSemanticEvidenceResponse(responseWithWhitespace)

      expect(result).toHaveLength(1)
      const evidenceItem = result[0]!
      expect(evidenceItem.text).toBe('Evidence with whitespace')
    })

    it('should handle empty evidence array', () => {
      const responseWithEmptyEvidence = JSON.stringify({
        evidence: [],
      })

      const result = parseSemanticEvidenceResponse(responseWithEmptyEvidence)
      expect(result).toEqual([])
    })

    it('should handle malformed evidence items gracefully', () => {
      const responseWithMalformedItems = JSON.stringify({
        evidence: [
          null, // null item
          'string item', // wrong type
          123, // wrong type
          {
            text: 'Valid item',
            confidence: 0.8,
          },
        ],
      })

      const result = parseSemanticEvidenceResponse(responseWithMalformedItems)

      // Should only process the valid item, others should be filtered out by schema validation
      expect(result).toHaveLength(1)
      const validItem = result[0]!
      expect(validItem.text).toBe('Valid item')
    })
  })

  describe('validateEvidenceItem', () => {
    it('should validate a valid evidence item', () => {
      const validItem = {
        text: 'Valid evidence text',
        confidence: 0.8,
        clinicalRelevance: 'significant',
        category: 'depression',
        rationale: 'Clinical rationale',
      }

      const result = validateEvidenceItem(validItem)

      expect(result.isValid).toBe(true)
      expect(result.evidenceItem).toBeDefined()
      expect(result.evidenceItem?.content).toBe('Valid evidence text')
      expect(result.evidenceItem?.confidence).toBe(0.8)
      expect(result.evidenceItem?.clinicalRelevance).toBe(0.75) // converted from 'significant'
      expect(result.errors).toHaveLength(0)
    })

    it('should reject non-object items', () => {
      const result = validateEvidenceItem('not an object')

      expect(result.isValid).toBe(false)
      expect(result.evidenceItem).toBeUndefined()
      expect(result.errors).toContain('Item is not an object')
    })

    it('should reject items without text field', () => {
      const itemWithoutText = {
        confidence: 0.8,
        clinicalRelevance: 'significant',
      }

      const result = validateEvidenceItem(itemWithoutText)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Text field is not a string')
    })

    it('should reject items with empty text', () => {
      const itemWithEmptyText = {
        text: '   ', // Only whitespace
        confidence: 0.8,
      }

      const result = validateEvidenceItem(itemWithEmptyText)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Text field is empty after trimming')
    })

    it('should handle invalid confidence values with warnings', () => {
      const itemWithInvalidConfidence = {
        text: 'Valid text',
        confidence: 'not a number',
      }

      const result = validateEvidenceItem(itemWithInvalidConfidence)

      expect(result.isValid).toBe(true)
      expect(result.evidenceItem?.confidence).toBe(0.5) // default
      expect(result.errors).toContain(
        'Confidence field is not a number, using default',
      )
    })

    it('should handle invalid clinical relevance with warnings', () => {
      const itemWithInvalidRelevance = {
        text: 'Valid text',
        clinicalRelevance: 'invalid_value',
      }

      const result = validateEvidenceItem(itemWithInvalidRelevance)

      expect(result.isValid).toBe(true)
      expect(result.evidenceItem?.clinicalRelevance).toBe('supportive') // default
      expect(result.errors).toContain(
        'Invalid clinical relevance value, using default',
      )
    })

    it('should apply defaults for missing optional fields', () => {
      const minimalItem = {
        text: 'Minimal text',
      }

      const result = validateEvidenceItem(minimalItem)

      expect(result.isValid).toBe(true)
      expect(result.evidenceItem?.confidence).toBe(0.5)
      expect(result.evidenceItem?.clinicalRelevance).toBe(0.5) // default value
      expect(result.evidenceItem?.source).toBe('semantic_analysis')
      expect(result.evidenceItem?.context?.['semanticRationale']).toBe(
        'Generated via semantic analysis',
      )
    })

    it('should clamp confidence values to valid range', () => {
      const itemWithHighConfidence = {
        text: 'High confidence text',
        confidence: 2.5,
      }

      const itemWithLowConfidence = {
        text: 'Low confidence text',
        confidence: -0.5,
      }

      const highResult = validateEvidenceItem(itemWithHighConfidence)
      const lowResult = validateEvidenceItem(itemWithLowConfidence)

      expect(highResult.evidenceItem?.confidence).toBe(1) // Clamped to max
      expect(lowResult.evidenceItem?.confidence).toBe(0) // Clamped to min
    })
  })
})
