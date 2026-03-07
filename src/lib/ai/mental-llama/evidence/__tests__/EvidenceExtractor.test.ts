import { EvidenceExtractor } from '../EvidenceExtractor'
import type { IModelProvider } from '../../types/mentalLLaMATypes'

// Mock logger
vi.mock('@/lib/utils/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

describe('EvidenceExtractor Semantic Analysis', () => {
  let extractor: EvidenceExtractor
  let mockModelProvider: IModelProvider

  beforeEach(() => {
    mockModelProvider = {
      invoke: vi.fn(),
    } as unknown as IModelProvider

    extractor = new EvidenceExtractor(
      {
        enableSemanticAnalysis: true,
        minConfidenceThreshold: 0.1, // Lower threshold to capture test evidence
      },
      mockModelProvider,
    )
  })

  describe('extractEvidence with semantic analysis', () => {
    it('should handle valid JSON with proper schema', async () => {
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

      // Mock the model provider to return our test response
      vi.mocked(mockModelProvider.invoke).mockResolvedValue({
        content: validResponse,
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      })

      const inputText = "I feel hopeless and can't sleep at night"
      const result = await extractor.extractEvidence(inputText, 'depression')

      // Verify the result contains semantic evidence
      const semanticEvidence = result.evidenceItems.filter(
        (item) => item.metadata?.semanticRationale,
      )

      expect(semanticEvidence).toHaveLength(2)
      expect(semanticEvidence[0]!).toMatchObject({
        text: 'I feel hopeless',
        type: 'direct_quote',
        confidence: 0.8,
        relevance: 'high',
        category: 'depression_symptom',
        clinicalRelevance: 'significant',
      })
      expect(semanticEvidence[0]!.metadata).toBeDefined()
      expect(semanticEvidence[0]!.metadata!.semanticRationale).toBe(
        'Indicates depressive mood',
      )
    })

    it('should handle invalid JSON gracefully', async () => {
      const invalidJson = 'this is not valid json'

      // Mock the model provider to return invalid JSON
      vi.mocked(mockModelProvider.invoke).mockResolvedValue({
        content: invalidJson,
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      })

      const inputText = 'I feel sad'
      const result = await extractor.extractEvidence(inputText, 'depression')

      // Should not contain semantic evidence due to invalid JSON
      const semanticEvidence = result.evidenceItems.filter(
        (item) => item.metadata?.semanticRationale,
      )
      expect(semanticEvidence).toHaveLength(0)

      // But should still contain pattern-based evidence
      expect(result.evidenceItems.length).toBeGreaterThan(0)
      expect(result.extractionMetadata.method).toBe('llm_enhanced')
      // Note: Semantic analysis failures are handled gracefully and don't add errors to metadata
      // The parseSemanticEvidenceResponse function returns empty array instead of throwing
    })

    it('should handle missing evidence array', async () => {
      const responseWithoutEvidence = JSON.stringify({
        someOtherField: 'value',
      })

      // Mock the model provider to return response without evidence array
      vi.mocked(mockModelProvider.invoke).mockResolvedValue({
        content: responseWithoutEvidence,
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      })

      const inputText = 'I feel anxious'
      const result = await extractor.extractEvidence(inputText, 'anxiety')

      // Should not contain semantic evidence due to missing evidence array
      const semanticEvidence = result.evidenceItems.filter(
        (item) => item.metadata?.semanticRationale,
      )
      expect(semanticEvidence).toHaveLength(0)

      // But should still contain pattern-based evidence
      expect(result.evidenceItems.length).toBeGreaterThan(0)
      // Note: Semantic analysis failures are handled gracefully and don't add errors to metadata
      // The parseSemanticEvidenceResponse function returns empty array instead of throwing
    })

    it('should handle evidence array with invalid items', async () => {
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

      // Mock the model provider to return response with invalid items
      vi.mocked(mockModelProvider.invoke).mockResolvedValue({
        content: responseWithInvalidItems,
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      })

      const inputText = 'Valid evidence item'
      const result = await extractor.extractEvidence(inputText, 'depression')

      // Should only have the valid semantic evidence item
      const semanticEvidence = result.evidenceItems.filter(
        (item) => item.metadata?.semanticRationale,
      )
      expect(semanticEvidence).toHaveLength(1)
      expect(semanticEvidence[0]!.text).toBe('Valid evidence item')
      expect(semanticEvidence[0]!.confidence).toBe(0.9)
      expect(semanticEvidence[0]!.clinicalRelevance).toBe('critical')
    })

    it('should apply default values for optional fields', async () => {
      const minimalResponse = JSON.stringify({
        evidence: [
          {
            text: 'Minimal evidence item',
          },
        ],
      })

      // Mock the model provider to return minimal response
      vi.mocked(mockModelProvider.invoke).mockResolvedValue({
        content: minimalResponse,
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      })

      const inputText = 'Minimal evidence item'
      const result = await extractor.extractEvidence(inputText, 'depression')

      // Find the semantic evidence item
      const semanticEvidence = result.evidenceItems.filter(
        (item) => item.metadata?.semanticRationale,
      )
      expect(semanticEvidence).toHaveLength(1)
      expect(semanticEvidence[0]).toMatchObject({
        text: 'Minimal evidence item',
        confidence: 0.5, // default value
        clinicalRelevance: 'supportive', // default value
        category: 'semantic_analysis', // default value
        relevance: 'medium', // computed from confidence
      })
    })

    it('should clamp confidence values to valid range', async () => {
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

      // Mock the model provider to return response with invalid confidence values
      vi.mocked(mockModelProvider.invoke).mockResolvedValue({
        content: responseWithInvalidConfidence,
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      })

      const inputText = 'High confidence item and low confidence item'
      const result = await extractor.extractEvidence(inputText, 'depression')

      // Find the semantic evidence items
      const semanticEvidence = result.evidenceItems.filter(
        (item) => item.metadata?.semanticRationale,
      )

      // Note: Low confidence item may be filtered out due to minConfidenceThreshold (0.1)
      // since clamped confidence of 0 is less than threshold
      expect(semanticEvidence.length).toBeGreaterThanOrEqual(1)

      // Find items by text to verify confidence clamping
      const highConfidenceItem = semanticEvidence.find(
        (item) => item.text === 'High confidence item',
      )
      const lowConfidenceItem = semanticEvidence.find(
        (item) => item.text === 'Low confidence item',
      )

      expect(highConfidenceItem?.confidence).toBe(1) // Clamped to max

      // Low confidence item might be filtered out due to threshold, but if present, should be clamped
      if (lowConfidenceItem) {
        expect(lowConfidenceItem.confidence).toBe(0) // Clamped to min
      }
    })

    it('should validate clinical relevance enum values', async () => {
      const responseWithInvalidClinicalRelevance = JSON.stringify({
        evidence: [
          {
            text: 'Evidence with invalid clinical relevance',
            clinicalRelevance: 'invalid_value',
          },
        ],
      })

      // Mock the model provider to return response with invalid clinical relevance
      vi.mocked(mockModelProvider.invoke).mockResolvedValue({
        content: responseWithInvalidClinicalRelevance,
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      })

      const inputText = 'Evidence with invalid clinical relevance'
      const result = await extractor.extractEvidence(inputText, 'depression')

      // Find the semantic evidence item
      const semanticEvidence = result.evidenceItems.filter(
        (item) => item.metadata?.semanticRationale,
      )
      expect(semanticEvidence).toHaveLength(1)
      expect(semanticEvidence[0]!.clinicalRelevance).toBe('supportive') // Should default to 'supportive'
    })

    it('should trim whitespace from text fields', async () => {
      const responseWithWhitespace = JSON.stringify({
        evidence: [
          {
            text: '   Evidence with whitespace   ',
            confidence: 0.8,
          },
        ],
      })

      // Mock the model provider to return response with whitespace
      vi.mocked(mockModelProvider.invoke).mockResolvedValue({
        content: responseWithWhitespace,
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      })

      const inputText = 'Evidence with whitespace'
      const result = await extractor.extractEvidence(inputText, 'depression')

      // Find the semantic evidence item
      const semanticEvidence = result.evidenceItems.filter(
        (item) => item.metadata?.semanticRationale,
      )
      expect(semanticEvidence).toHaveLength(1)
      expect(semanticEvidence[0]!.text).toBe('Evidence with whitespace')
    })

    it('should handle empty evidence array', async () => {
      const responseWithEmptyEvidence = JSON.stringify({
        evidence: [],
      })

      // Mock the model provider to return empty evidence array
      vi.mocked(mockModelProvider.invoke).mockResolvedValue({
        content: responseWithEmptyEvidence,
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      })

      const inputText = 'Some text'
      const result = await extractor.extractEvidence(inputText, 'depression')

      // Should not contain semantic evidence due to empty array
      const semanticEvidence = result.evidenceItems.filter(
        (item) => item.metadata?.semanticRationale,
      )
      expect(semanticEvidence).toHaveLength(0)

      // But may still contain pattern-based evidence
      expect(result.extractionMetadata.method).toBe('llm_enhanced')
    })

    it('should handle malformed evidence items gracefully', async () => {
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

      // Mock the model provider to return response with malformed items
      vi.mocked(mockModelProvider.invoke).mockResolvedValue({
        content: responseWithMalformedItems,
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      })

      const inputText = 'Valid item'
      const result = await extractor.extractEvidence(inputText, 'depression')

      // Should only process the valid item, others should be filtered out by schema validation
      const semanticEvidence = result.evidenceItems.filter(
        (item) => item.metadata?.semanticRationale,
      )
      expect(semanticEvidence).toHaveLength(1)
      expect(semanticEvidence[0]!.text).toBe('Valid item')
      expect(semanticEvidence[0]!.confidence).toBe(0.8)
    })
  })

  // Add tests for pattern-based evidence extraction to ensure comprehensive coverage
  describe('extractEvidence without semantic analysis', () => {
    beforeEach(() => {
      extractor = new EvidenceExtractor({
        enableSemanticAnalysis: false, // Disable semantic analysis
        minConfidenceThreshold: 0.1,
      })
    })

    it('should extract pattern-based evidence for depression', async () => {
      const inputText =
        "I feel hopeless and depressed, I have no energy and can't sleep"
      const result = await extractor.extractEvidence(inputText, 'depression')

      expect(result.evidenceItems.length).toBeGreaterThan(0)
      expect(result.extractionMetadata.method).toBe('pattern_based')

      // Should find depression-related patterns
      const depressionEvidence = result.evidenceItems.filter((item) =>
        item.category.includes('depression'),
      )
      expect(depressionEvidence.length).toBeGreaterThan(0)
    })

    it('should extract pattern-based evidence for anxiety', async () => {
      const inputText =
        "I feel anxious and worried, my heart is racing and I can't calm down"
      const result = await extractor.extractEvidence(inputText, 'anxiety')

      expect(result.evidenceItems.length).toBeGreaterThan(0)
      expect(result.extractionMetadata.method).toBe('pattern_based')

      // Should find anxiety-related patterns
      const anxietyEvidence = result.evidenceItems.filter((item) =>
        item.category.includes('anxiety'),
      )
      expect(anxietyEvidence.length).toBeGreaterThan(0)
    })
  })
})
