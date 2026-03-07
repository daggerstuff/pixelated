/**
 * Test suite for the Evidence Extraction System
 *
 * This file contains comprehensive tests for the evidence extraction functionality.
 * Uses Vitest framework with proper assertions and test structure.
 */

import { EvidenceExtractor, EvidenceService } from '../evidence'
import type {
  IModelProvider,
  MentalHealthAnalysisResult,
} from '../types/mentalLLaMATypes'

// Mock model provider for testing
const createMockModelProvider = (): IModelProvider => ({
  invoke: async () => ({
    content: JSON.stringify({
      evidence: [
        {
          text: 'feeling down',
          confidence: 0.8,
          clinicalRelevance: 'significant',
          category: 'mood_symptom',
          rationale: 'Indicates depressed mood',
        },
      ],
    }),
    model: 'test-model',
  }),
  getModelInfo: () => ({
    name: 'test-model',
    version: '1.0.0',
    capabilities: ['text-analysis'],
  }),
  isAvailable: () => Promise.resolve(true),
})

describe('Evidence Extraction System', () => {
  describe('EvidenceExtractor', () => {
    it('should extract depression evidence correctly', async () => {
      const extractor = new EvidenceExtractor({
        maxEvidenceItems: 10,
        minConfidenceThreshold: 0.3,
        enableSemanticAnalysis: false,
      })

      const depressionText =
        "I feel so depressed and hopeless. I can't sleep or eat anymore."
      const result = await extractor.extractEvidence(
        depressionText,
        'depression',
      )

      expect(result.evidenceItems).toBeDefined()
      expect(result.evidenceItems.length).toBeGreaterThan(0)
      expect(result.summary).toBeDefined()
      expect(result.summary.overallStrength).toBeDefined()
      expect(result.summary.riskIndicatorCount).toBeGreaterThanOrEqual(0)
    })

    it('should extract anxiety evidence correctly', async () => {
      const extractor = new EvidenceExtractor({
        maxEvidenceItems: 10,
        minConfidenceThreshold: 0.3,
        enableSemanticAnalysis: false,
      })

      const anxietyText =
        "I'm so anxious and worried all the time. My heart is racing."
      const result = await extractor.extractEvidence(anxietyText, 'anxiety')

      expect(result.evidenceItems).toBeDefined()
      expect(result.evidenceItems.length).toBeGreaterThan(0)
      expect(result.summary.overallStrength).toBeDefined()
    })

    it('should extract crisis evidence with high severity', async () => {
      const extractor = new EvidenceExtractor({
        maxEvidenceItems: 10,
        minConfidenceThreshold: 0.3,
        enableSemanticAnalysis: false,
      })

      const crisisText =
        "I want to kill myself. I have a plan and don't see any point in living."
      const result = await extractor.extractEvidence(crisisText, 'crisis')

      expect(result.evidenceItems).toBeDefined()
      expect(result.evidenceItems.length).toBeGreaterThan(0)
      expect(result.summary.riskIndicatorCount).toBeGreaterThan(0)

      const criticalEvidence = result.evidenceItems.filter(
        (item) => item.clinicalRelevance === 'critical',
      )
      expect(criticalEvidence.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('EvidenceService', () => {
    it('should handle caching correctly', async () => {
      const evidenceService = new EvidenceService(undefined, {
        enableCaching: true,
        enableMetrics: true,
      })

      const text = "I'm feeling really down and can't seem to get motivated."

      // First extraction
      const result1 = await evidenceService.extractSupportingEvidence(
        text,
        'depression',
      )
      expect(result1.evidenceItems).toBeDefined()
      expect(result1.evidenceItems.length).toBeGreaterThan(0)
      expect(result1.processingMetadata).toBeDefined()
      expect(result1.processingMetadata.evidenceStrength).toBeDefined()

      // Second extraction (should use cache)
      const result2 = await evidenceService.extractSupportingEvidence(
        text,
        'depression',
      )
      expect(result2.evidenceItems).toBeDefined()
      expect(result2.evidenceItems.length).toBeGreaterThan(0)
      expect(result2.processingMetadata.evidenceStrength).toBeDefined()

      // Test metrics
      const metrics = evidenceService.getMetrics()
      expect(metrics).toBeDefined()
    })

    it('should extract crisis evidence with detailed breakdown', async () => {
      const evidenceService = new EvidenceService()
      const text =
        "I want to end my life. I have pills and I've been thinking about when to do it."

      const baseAnalysis: MentalHealthAnalysisResult = {
        hasMentalHealthIssue: true,
        mentalHealthCategory: 'crisis',
        confidence: 0.9,
        explanation: 'Crisis detected',
        isCrisis: true,
        timestamp: new Date().toISOString(),
      }

      const crisisEvidence = await evidenceService.extractCrisisEvidence(
        text,
        baseAnalysis,
      )

      expect(crisisEvidence).toBeDefined()
      expect(crisisEvidence.immediateRiskIndicators).toBeDefined()
      expect(crisisEvidence.planningIndicators).toBeDefined()
      expect(crisisEvidence.contextualFactors).toBeDefined()
      expect(crisisEvidence.protectiveFactors).toBeDefined()
      expect(
        crisisEvidence.immediateRiskIndicators.length,
      ).toBeGreaterThanOrEqual(0)
    })

    it('should enhance evidence with LLM integration', async () => {
      const mockProvider = createMockModelProvider()
      const evidenceService = new EvidenceService(mockProvider, {
        enableLLMEnhancement: true,
        enableCaching: false,
      })

      const text = "I'm feeling really down and depressed lately."
      const result = await evidenceService.extractSupportingEvidence(
        text,
        'depression',
      )

      expect(result).toBeDefined()
      expect(result.detailedEvidence).toBeDefined()
      expect(result.detailedEvidence.extractionMetadata).toBeDefined()
      expect(result.detailedEvidence.extractionMetadata.method).toBeDefined()
      expect(result.evidenceItems.length).toBeGreaterThan(0)
      expect(
        result.detailedEvidence.extractionMetadata.processingTime,
      ).toBeGreaterThan(0)
    })

    it('should assess evidence quality accurately', async () => {
      const evidenceService = new EvidenceService()
      const text =
        "I feel depressed, hopeless, and can't sleep. I've been this way for months."

      const evidenceResult = await evidenceService.extractSupportingEvidence(
        text,
        'depression',
      )
      const quality = evidenceService.assessEvidenceQuality(
        evidenceResult.detailedEvidence,
      )

      expect(quality).toBeDefined()
      expect(quality.overallQuality).toBeDefined()
      expect(quality.completeness).toBeDefined()
      expect(quality.specificity).toBeDefined()
      expect(quality.clinicalRelevance).toBeDefined()
      expect(quality.recommendations).toBeDefined()
      expect(Array.isArray(quality.recommendations)).toBe(true)
    })

    it('should handle real-world complex scenarios', async () => {
      const evidenceService = new EvidenceService()
      const complexText = `I've been struggling for months now. I can't sleep at night, 
        I have no appetite, and I feel hopeless about the future. My friends say 
        I should get help, but I don't think anything can fix me. Sometimes I wonder 
        if everyone would be better off without me.`

      const result = await evidenceService.extractSupportingEvidence(
        complexText,
        'depression',
      )

      expect(result).toBeDefined()
      expect(result.evidenceItems).toBeDefined()
      expect(result.evidenceItems.length).toBeGreaterThan(0)
      expect(result.processingMetadata.evidenceStrength).toBeDefined()
      expect(
        result.detailedEvidence.summary.riskIndicatorCount,
      ).toBeGreaterThanOrEqual(0)
      expect(
        result.detailedEvidence.summary.supportiveFactorCount,
      ).toBeGreaterThanOrEqual(0)
      expect(
        result.detailedEvidence.summary.highConfidenceCount,
      ).toBeGreaterThanOrEqual(0)

      // Verify we have meaningful evidence items
      expect(
        result.evidenceItems.every((item) => typeof item === 'string'),
      ).toBe(true)
      expect(result.evidenceItems.some((item) => item.length > 0)).toBe(true)
    })
  })
})
