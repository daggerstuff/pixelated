// Unit tests for demo helper functions

import { describe, it, expect, beforeEach } from 'vitest'
import {
  PRESET_SCENARIOS,
  calculateBiasFactors,
  generateCounterfactualScenarios,
  generateHistoricalComparison,
  generateRecommendations,
  createExportData,
  getPresetScenario,
  getPresetScenariosByCategory,
  getPresetScenariosByRiskLevel,
  determineAlertLevel,
  generateSessionId,
} from './demo-helpers'
import type { SessionData, BiasAnalysisResults } from '../types/bias-detection'

describe('Demo Helpers', () => {
  let mockSessionData: SessionData

  beforeEach(() => {
    mockSessionData = {
      sessionId: 'test-session-123',
      scenario: 'anxiety-treatment',
      demographics: {
        age: '26-35',
        gender: 'female',
        ethnicity: 'hispanic',
        primaryLanguage: 'es',
      },
      content:
        'Therapist: You people from your culture tend to be more emotional about these things.',
      timestamp: new Date('2024-01-01T00:00:00Z'),
    }
  })

  describe('PRESET_SCENARIOS', () => {
    it('should contain all required preset scenarios', () => {
      expect(PRESET_SCENARIOS).toHaveLength(6)

      const scenarioIds = PRESET_SCENARIOS.map((s) => s.id)
      expect(scenarioIds).toContain('high-bias-cultural')
      expect(scenarioIds).toContain('medium-bias-gender')
      expect(scenarioIds).toContain('low-bias-inclusive')
      expect(scenarioIds).toContain('high-bias-age')
      expect(scenarioIds).toContain('medium-bias-linguistic')
      expect(scenarioIds).toContain('critical-bias-intersectional')
    })

    it('should have proper risk level distribution', () => {
      const riskLevels = PRESET_SCENARIOS.map((s) => s.riskLevel)
      expect(riskLevels).toContain('low')
      expect(riskLevels).toContain('medium')
      expect(riskLevels).toContain('high')
      expect(riskLevels).toContain('critical')
    })

    it('should have diverse categories', () => {
      const categories = PRESET_SCENARIOS.map((s) => s.category)
      expect(categories).toContain('cultural')
      expect(categories).toContain('gender')
      expect(categories).toContain('age')
      expect(categories).toContain('linguistic')
      expect(categories).toContain('intersectional')
    })

    it('should have learning objectives for each scenario', () => {
      PRESET_SCENARIOS.forEach((scenario) => {
        expect(scenario.learningObjectives).toBeDefined()
        expect(scenario.learningObjectives.length).toBeGreaterThan(0)
      })
    })
  })

  describe('calculateBiasFactors', () => {
    it('should calculate higher bias for problematic content', () => {
      const biasFactors = calculateBiasFactors(mockSessionData)

      expect(biasFactors.overall).toBeGreaterThan(0.25)
      expect(biasFactors.cultural).toBeGreaterThan(0.15)
      expect(biasFactors.racial).toBeGreaterThan(0.1)
    })

    it('should calculate lower bias for inclusive content', () => {
      const inclusiveSessionData = {
        ...mockSessionData,
        content:
          'Therapist: How are you feeling today? Can you tell me more about your experience?',
        demographics: {
          age: '26-35',
          gender: 'male',
          ethnicity: 'white',
          primaryLanguage: 'en',
        },
      }

      const biasFactors = calculateBiasFactors(inclusiveSessionData)
      expect(biasFactors.overall).toBeLessThan(0.4)
    })

    it('should increase linguistic bias for non-English speakers', () => {
      const biasFactors = calculateBiasFactors(mockSessionData)
      expect(biasFactors.linguistic).toBeGreaterThan(0.2)
    })

    it('should cap bias scores at reasonable maximums', () => {
      const extremeSessionData = {
        ...mockSessionData,
        content:
          'your people culture traditional background heritage naturally instinct emotional at your age elderly community neighborhood statistics show speak slowly simpler words',
      }

      const biasFactors = calculateBiasFactors(extremeSessionData)
      expect(biasFactors.overall).toBeLessThanOrEqual(0.95)
      expect(biasFactors.cultural).toBeLessThanOrEqual(0.8)
    })
  })

  describe('generateCounterfactualScenarios', () => {
    it('should generate scenarios for high bias factors', () => {
      const biasFactors = {
        overall: 0.7,
        linguistic: 0.6,
        gender: 0.5,
        racial: 0.4,
        age: 0.6,
        cultural: 0.5,
        model: 0.6,
        interactive: 0.6,
        evaluation: 0.6,
      }

      const scenarios = generateCounterfactualScenarios(
        mockSessionData,
        biasFactors,
      )
      expect(scenarios.length).toBeGreaterThan(3)

      const scenarioChanges = scenarios.map((s) => s.change)
      expect(scenarioChanges.some((change) => change.includes('Age'))).toBe(
        true,
      )
      expect(
        scenarioChanges.some((change) => change.includes('Cultural')),
      ).toBe(true)
      expect(
        scenarioChanges.some((change) => change.includes('Language')),
      ).toBe(true)
    })

    it('should include therapeutic approach counterfactual', () => {
      const biasFactors = {
        overall: 0.3,
        linguistic: 0.2,
        gender: 0.2,
        racial: 0.2,
        age: 0.2,
        cultural: 0.2,
        model: 0.3,
        interactive: 0.3,
        evaluation: 0.3,
      }

      const scenarios = generateCounterfactualScenarios(
        mockSessionData,
        biasFactors,
      )
      expect(
        scenarios.some((s) => s.change.includes('Therapeutic Language')),
      ).toBe(true)
    })

    it('should assign appropriate likelihood levels', () => {
      const biasFactors = {
        overall: 0.8,
        linguistic: 0.7,
        gender: 0.6,
        racial: 0.5,
        age: 0.4,
        cultural: 0.3,
        model: 0.7,
        interactive: 0.7,
        evaluation: 0.7,
      }

      const scenarios = generateCounterfactualScenarios(
        mockSessionData,
        biasFactors,
      )
      const highLikelihoodScenarios = scenarios.filter(
        (s) => s.likelihood === 'high',
      )
      expect(highLikelihoodScenarios.length).toBeGreaterThan(0)
    })
  })

  describe('generateHistoricalComparison', () => {
    it('should generate realistic historical data', () => {
      const comparison = generateHistoricalComparison(0.5)

      expect(comparison.thirtyDayAverage).toBeGreaterThanOrEqual(0)
      expect(comparison.thirtyDayAverage).toBeLessThanOrEqual(1)
      expect(comparison.percentileRank).toBeGreaterThanOrEqual(0)
      expect(comparison.percentileRank).toBeLessThanOrEqual(100)
      expect(['improving', 'stable', 'worsening']).toContain(
        comparison.sevenDayTrend,
      )
    })

    it('should correctly determine trend direction', () => {
      const lowBiasComparison = generateHistoricalComparison(0.1)
      const highBiasComparison = generateHistoricalComparison(0.8)

      // Both should have valid trend values
      expect(['improving', 'stable', 'worsening']).toContain(
        lowBiasComparison.sevenDayTrend,
      )
      expect(['improving', 'stable', 'worsening']).toContain(
        highBiasComparison.sevenDayTrend,
      )
    })
  })

  describe('generateRecommendations', () => {
    it('should generate critical recommendations for high bias', () => {
      const highBiasFactors = {
        overall: 0.8,
        linguistic: 0.7,
        gender: 0.6,
        racial: 0.7,
        age: 0.5,
        cultural: 0.6,
        model: 0.7,
        interactive: 0.7,
        evaluation: 0.7,
      }

      const recommendations = generateRecommendations(
        highBiasFactors,
        mockSessionData.demographics,
      )
      expect(
        recommendations.some((r) => r.includes('Critical bias detected')),
      ).toBe(true)
      expect(
        recommendations.some((r) => r.includes('racial bias patterns')),
      ).toBe(true)
      expect(recommendations.length).toBeGreaterThan(5)
    })

    it('should generate fewer recommendations for low bias', () => {
      const lowBiasFactors = {
        overall: 0.2,
        linguistic: 0.1,
        gender: 0.1,
        racial: 0.1,
        age: 0.1,
        cultural: 0.1,
        model: 0.2,
        interactive: 0.2,
        evaluation: 0.2,
      }

      const recommendations = generateRecommendations(
        lowBiasFactors,
        mockSessionData.demographics,
      )
      expect(recommendations.length).toBeLessThan(5)
    })

    it('should include demographic-specific recommendations', () => {
      const biasFactors = {
        overall: 0.5,
        linguistic: 0.4,
        gender: 0.3,
        racial: 0.3,
        age: 0.3,
        cultural: 0.4,
        model: 0.4,
        interactive: 0.4,
        evaluation: 0.4,
      }

      const nonBinaryDemographics = {
        ...mockSessionData.demographics,
        gender: 'non-binary',
      }

      const recommendations = generateRecommendations(
        biasFactors,
        nonBinaryDemographics,
      )
      expect(recommendations.some((r) => r.includes('pronouns'))).toBe(true)
    })
  })

  describe('createExportData', () => {
    it('should create properly structured export data', () => {
      const mockAnalysisResults: BiasAnalysisResults = {
        sessionId: 'test-123',
        timestamp: new Date(),
        overallBiasScore: 0.5,
        alertLevel: 'medium',
        confidence: 0.85,
        layerResults: {
          preprocessing: {
            biasScore: 0.4,
            linguisticBias: {
              genderBiasScore: 0.3,
              racialBiasScore: 0.4,
              ageBiasScore: 0.2,
              culturalBiasScore: 0.5,
            },
            representationAnalysis: {
              diversityIndex: 0.6,
              underrepresentedGroups: ['elderly'],
            },
          },
          modelLevel: {
            biasScore: 0.45,
            fairnessMetrics: {
              demographicParity: 0.7,
              equalizedOdds: 0.75,
              calibration: 0.8,
            },
          },
          interactive: {
            biasScore: 0.5,
            counterfactualAnalysis: {
              scenariosAnalyzed: 10,
              biasDetected: true,
              consistencyScore: 0.7,
            },
          },
          evaluation: {
            biasScore: 0.55,
            huggingFaceMetrics: {
              bias: 0.4,
              stereotype: 0.6,
              regard: { positive: 0.6, negative: 0.4 },
            },
          },
        },
        recommendations: ['Test recommendation'],
        demographics: mockSessionData.demographics,
      }

      const counterfactualScenarios = generateCounterfactualScenarios(
        mockSessionData,
        {
          overall: 0.5,
          linguistic: 0.4,
          gender: 0.3,
          racial: 0.4,
          age: 0.3,
          cultural: 0.4,
          model: 0.4,
          interactive: 0.4,
          evaluation: 0.4,
        },
      )

      const historicalComparison = generateHistoricalComparison(0.5)

      const exportData = createExportData(
        mockAnalysisResults,
        counterfactualScenarios,
        historicalComparison,
      )

      expect(exportData.timestamp).toBeDefined()
      expect(exportData.sessionId).toBe('test-123')
      expect(exportData.analysis).toBe(mockAnalysisResults)
      expect(exportData.counterfactualScenarios).toBe(counterfactualScenarios)
      expect(exportData.historicalComparison).toBe(historicalComparison)
      expect(exportData.metadata.version).toBe('2.0.0')
      expect(exportData.metadata.demoType).toBe('enhanced-bias-detection')
    })
  })

  describe('getPresetScenario', () => {
    it('should return correct scenario by ID', () => {
      const scenario = getPresetScenario('high-bias-cultural')
      expect(scenario).toBeDefined()
      expect(scenario?.name).toBe('High Cultural Bias')
      expect(scenario?.riskLevel).toBe('critical')
    })

    it('should return undefined for non-existent ID', () => {
      const scenario = getPresetScenario('non-existent-id')
      expect(scenario).toBeUndefined()
    })
  })

  describe('getPresetScenariosByCategory', () => {
    it('should return scenarios for valid category', () => {
      const culturalScenarios = getPresetScenariosByCategory('cultural')
      expect(culturalScenarios.length).toBeGreaterThan(0)
      culturalScenarios.forEach((scenario) => {
        expect(scenario.category).toBe('cultural')
      })
    })

    it('should return empty array for invalid category', () => {
      const scenarios = getPresetScenariosByCategory('invalid-category')
      expect(scenarios).toHaveLength(0)
    })
  })

  describe('getPresetScenariosByRiskLevel', () => {
    it('should return scenarios for valid risk level', () => {
      const highRiskScenarios = getPresetScenariosByRiskLevel('high')
      expect(highRiskScenarios.length).toBeGreaterThan(0)
      highRiskScenarios.forEach((scenario) => {
        expect(scenario.riskLevel).toBe('high')
      })
    })
  })

  describe('determineAlertLevel', () => {
    it('should return correct alert levels', () => {
      expect(determineAlertLevel(0.9)).toBe('critical')
      expect(determineAlertLevel(0.7)).toBe('high')
      expect(determineAlertLevel(0.5)).toBe('medium')
      expect(determineAlertLevel(0.2)).toBe('low')
    })

    it('should handle edge cases', () => {
      expect(determineAlertLevel(0.8)).toBe('critical')
      expect(determineAlertLevel(0.6)).toBe('high')
      expect(determineAlertLevel(0.4)).toBe('medium')
      expect(determineAlertLevel(0)).toBe('low')
    })
  })

  describe('generateSessionId', () => {
    it('should generate unique session IDs', () => {
      const id1 = generateSessionId()
      const id2 = generateSessionId()

      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^demo_\d+_[a-z0-9]+$/)
      expect(id2).toMatch(/^demo_\d+_[a-z0-9]+$/)
    })

    it('should include timestamp and random component', () => {
      const id = generateSessionId()
      const parts = id.split('_')

      expect(parts).toHaveLength(3)
      expect(parts[0]).toBe('demo')
      expect(parseInt(parts[1])).toBeGreaterThan(0)
      expect(parts[2]).toMatch(/^[a-z0-9]+$/)
    })
  })
})
