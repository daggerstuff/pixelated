/**
 * Unit tests for objective evaluation metrics system
 */

import { describe, it as test, expect, beforeEach } from 'vitest'
import {
  ObjectiveMetricsEngine,
  DEFAULT_METRICS_CONFIG,
  MetricsConfig,
} from './objective-metrics'
import {
  AlignmentEvaluationResult,
  AggregationMethod,
} from './objective-interfaces'
import {
  ObjectiveDefinition,
  AlignmentContext,
  ContextType,
} from './objectives'

describe('ObjectiveMetricsEngine', () => {
  let engine: ObjectiveMetricsEngine
  let mockObjectives: ObjectiveDefinition[]
  let mockContext: AlignmentContext
  let mockEvaluationResult: AlignmentEvaluationResult

  beforeEach(() => {
    engine = new ObjectiveMetricsEngine(DEFAULT_METRICS_CONFIG)

    mockObjectives = [
      {
        id: 'correctness',
        name: 'Correctness',
        description: 'Factual accuracy and correctness',
        weight: 0.4,
        criteria: [
          {
            criterion: 'accuracy',
            description: 'How accurate the response is',
            weight: 0.6,
          },
          {
            criterion: 'completeness',
            description: 'How complete the response is',
            weight: 0.4,
          },
        ],
        evaluationFunction: () => 0.8,
      },
      {
        id: 'empathy',
        name: 'Empathy',
        description: 'Emotional understanding and support',
        weight: 0.3,
        criteria: [
          {
            criterion: 'emotional_recognition',
            description: 'Ability to recognize emotions',
            weight: 0.5,
          },
          {
            criterion: 'supportive_language',
            description: 'Use of supportive language',
            weight: 0.5,
          },
        ],
        evaluationFunction: () => 0.7,
      },
      {
        id: 'safety',
        name: 'Safety',
        description: 'Safety and harm prevention',
        weight: 0.3,
        criteria: [
          {
            criterion: 'harm_prevention',
            description: 'Prevention of potential harm',
            weight: 0.7,
          },
          {
            criterion: 'risk_assessment',
            description: 'Assessment of risks',
            weight: 0.3,
          },
        ],
        evaluationFunction: () => 0.9,
      },
    ]

    mockContext = {
      userQuery: 'I need help with my anxiety',
      detectedContext: ContextType.SUPPORT,
      conversationHistory: [],
      sessionMetadata: {},
    }

    mockEvaluationResult = {
      overallScore: 0.8,
      objectiveResults: {
        correctness: {
          objectiveId: 'correctness',
          score: 0.8,
          confidence: 0.9,
          criteriaScores: {
            accuracy: 0.85,
            completeness: 0.75,
          },
          metadata: {
            evaluationTime: 150,
            contextFactors: ['user_query', 'conversation_history'],
            adjustmentFactors: { urgency: 0.1, complexity: 0.2 },
          },
        },
        empathy: {
          objectiveId: 'empathy',
          score: 0.7,
          confidence: 0.8,
          criteriaScores: {
            emotional_recognition: 0.75,
            supportive_language: 0.65,
          },
          metadata: {
            evaluationTime: 120,
            contextFactors: ['emotional_tone', 'support_needed'],
            adjustmentFactors: { empathy_boost: 0.15 },
          },
        },
        safety: {
          objectiveId: 'safety',
          score: 0.9,
          confidence: 0.95,
          criteriaScores: {
            harm_prevention: 0.95,
            risk_assessment: 0.8,
          },
          metadata: {
            evaluationTime: 100,
            contextFactors: ['crisis_indicators', 'safety_concerns'],
            adjustmentFactors: { safety_priority: 0.3 },
          },
        },
      },
      aggregationMethod: AggregationMethod.WEIGHTED_AVERAGE,
      evaluationContext: mockContext,
      timestamp: new Date(),
      weights: { correctness: 0.4, empathy: 0.3, safety: 0.3 },
      normalizedScores: { correctness: 0.8, empathy: 0.7, safety: 0.9 },
    }
  })

  describe('calculateObjectiveMetrics', () => {
    test('should calculate basic objective metrics correctly', () => {
      const objective = mockObjectives[0] // correctness
      const evaluationResult = mockEvaluationResult.objectiveResults.correctness

      const metrics = engine.calculateObjectiveMetrics(
        objective,
        evaluationResult,
        mockContext,
      )

      expect(metrics.objectiveId).toBe('correctness')
      expect(metrics.score).toBe(0.8)
      expect(metrics.confidence).toBeGreaterThan(0)
      expect(metrics.confidence).toBeLessThanOrEqual(1)
      expect(metrics.reliability).toBeGreaterThanOrEqual(0)
      expect(metrics.reliability).toBeLessThanOrEqual(1)
      expect(metrics.consistency).toBeGreaterThanOrEqual(0)
      expect(metrics.consistency).toBeLessThanOrEqual(1)
      expect(metrics.contextualFit).toBeGreaterThan(0)
      expect(metrics.contextualFit).toBeLessThanOrEqual(1)
    })

    test('should calculate criteria breakdown correctly', () => {
      const objective = mockObjectives[0] // correctness
      const evaluationResult = mockEvaluationResult.objectiveResults.correctness

      const metrics = engine.calculateObjectiveMetrics(
        objective,
        evaluationResult,
        mockContext,
      )

      expect(metrics.criteriaBreakdown).toHaveLength(2)

      const accuracyCriteria = metrics.criteriaBreakdown.find(
        (c) => c.criterion === 'accuracy',
      )
      expect(accuracyCriteria).toBeDefined()
      expect(accuracyCriteria!.score).toBe(0.85)
      expect(accuracyCriteria!.weight).toBe(0.6)
      expect(accuracyCriteria!.contribution).toBeCloseTo(0.85 * 0.6, 5)
      expect(accuracyCriteria!.confidence).toBeGreaterThan(0)
      expect(accuracyCriteria!.evidence).toBeInstanceOf(Array)
    })

    test('should calculate trend information', () => {
      const objective = mockObjectives[0] // correctness
      const evaluationResult = mockEvaluationResult.objectiveResults.correctness

      const metrics = engine.calculateObjectiveMetrics(
        objective,
        evaluationResult,
        mockContext,
      )

      expect(metrics.trend).toBeDefined()
      expect(['improving', 'declining', 'stable']).toContain(
        metrics.trend.direction,
      )
      expect(metrics.trend.magnitude).toBeGreaterThanOrEqual(0)
      expect(metrics.trend.magnitude).toBeLessThanOrEqual(1)
      expect(metrics.trend.confidence).toBeGreaterThanOrEqual(0)
      expect(metrics.trend.confidence).toBeLessThanOrEqual(1)
    })
  })

  describe('calculateAlignmentMetrics', () => {
    test('should calculate comprehensive alignment metrics', () => {
      const metrics = engine.calculateAlignmentMetrics(
        mockEvaluationResult,
        mockObjectives,
      )

      expect(metrics.overallScore).toBe(0.8)
      expect(Object.keys(metrics.objectiveMetrics)).toHaveLength(3)
      expect(metrics.objectiveMetrics.correctness).toBeDefined()
      expect(metrics.objectiveMetrics.empathy).toBeDefined()
      expect(metrics.objectiveMetrics.safety).toBeDefined()

      expect(metrics.balanceScore).toBeGreaterThanOrEqual(0)
      expect(metrics.balanceScore).toBeLessThanOrEqual(1)
      expect(metrics.consistencyScore).toBeGreaterThanOrEqual(0)
      expect(metrics.consistencyScore).toBeLessThanOrEqual(1)
      expect(metrics.contextualAlignment).toBeGreaterThanOrEqual(0)
      expect(metrics.contextualAlignment).toBeLessThanOrEqual(1)
    })

    test('should generate quality indicators', () => {
      const metrics = engine.calculateAlignmentMetrics(
        mockEvaluationResult,
        mockObjectives,
      )

      expect(metrics.qualityIndicators).toBeDefined()
      expect(metrics.qualityIndicators.reliability).toBeGreaterThanOrEqual(0)
      expect(metrics.qualityIndicators.reliability).toBeLessThanOrEqual(1)
      expect(metrics.qualityIndicators.validity).toBeGreaterThanOrEqual(0)
      expect(metrics.qualityIndicators.validity).toBeLessThanOrEqual(1)
      expect(metrics.qualityIndicators.sensitivity).toBeGreaterThanOrEqual(0)
      expect(metrics.qualityIndicators.sensitivity).toBeLessThanOrEqual(1)
      expect(metrics.qualityIndicators.specificity).toBeGreaterThanOrEqual(0)
      expect(metrics.qualityIndicators.specificity).toBeLessThanOrEqual(1)
      expect(metrics.qualityIndicators.coverage).toBeGreaterThanOrEqual(0)
      expect(metrics.qualityIndicators.coverage).toBeLessThanOrEqual(1)
    })

    test('should generate performance profile', () => {
      const metrics = engine.calculateAlignmentMetrics(
        mockEvaluationResult,
        mockObjectives,
      )

      expect(metrics.performanceProfile).toBeDefined()
      expect(metrics.performanceProfile.strengths).toBeInstanceOf(Array)
      expect(metrics.performanceProfile.weaknesses).toBeInstanceOf(Array)
      expect(metrics.performanceProfile.opportunities).toBeInstanceOf(Array)
      expect(metrics.performanceProfile.risks).toBeInstanceOf(Array)

      // Safety should be in strengths (highest score: 0.9)
      expect(metrics.performanceProfile.strengths).toContain('safety')
      // Empathy should be in weaknesses (lowest score: 0.7)
      expect(metrics.performanceProfile.weaknesses).toContain('empathy')
    })
  })

  describe('addEvaluation and history tracking', () => {
    test('should add evaluation to history', () => {
      const initialBenchmarks = engine.getBenchmarks()

      engine.addEvaluation(mockEvaluationResult, mockObjectives)

      // Should have updated benchmarks
      const updatedBenchmarks = engine.getBenchmarks()
      expect(updatedBenchmarks.length).toBeGreaterThanOrEqual(
        initialBenchmarks.length,
      )
    })

    test('should track trends after multiple evaluations', () => {
      // Add multiple evaluations with varying scores
      const evaluations = []
      for (let i = 0; i < 5; i++) {
        const evaluation = {
          ...mockEvaluationResult,
          timestamp: new Date(Date.now() + i * 1000),
          objectiveResults: {
            ...mockEvaluationResult.objectiveResults,
            correctness: {
              ...mockEvaluationResult.objectiveResults.correctness,
              score: 0.7 + i * 0.05, // Improving trend
            },
          },
        }
        evaluations.push(evaluation)
        engine.addEvaluation(evaluation, mockObjectives)
      }

      const trend = engine.getTrend('correctness')
      expect(trend).toBeDefined()
      expect(trend!.direction).toBe('improving')
      expect(trend!.period).toBe(5)
    })

    test('should maintain history window size', () => {
      const config: MetricsConfig = {
        ...DEFAULT_METRICS_CONFIG,
        historyWindow: 3,
      }
      const smallEngine = new ObjectiveMetricsEngine(config)

      // Add more evaluations than history window
      for (let i = 0; i < 10; i++) {
        const evaluation = {
          ...mockEvaluationResult,
          timestamp: new Date(Date.now() + i * 1000),
        }
        smallEngine.addEvaluation(evaluation, mockObjectives)
      }

      // History should be limited (allowing some buffer)
      expect(
        smallEngine['evaluationHistory'].evaluations.length,
      ).toBeLessThanOrEqual(6)
    })
  })

  describe('baseline and improvement tracking', () => {
    test('should set and use baselines for improvement calculation', () => {
      engine.setBaseline('correctness', 0.6)

      const objective = mockObjectives[0]
      const evaluationResult = mockEvaluationResult.objectiveResults.correctness
      const metrics = engine.calculateObjectiveMetrics(
        objective,
        evaluationResult,
        mockContext,
      )

      expect(metrics.improvement).toBeCloseTo(0.8 - 0.6, 5) // 0.2 improvement
    })

    test('should use first evaluation as baseline when none set', () => {
      // Add first evaluation
      engine.addEvaluation(mockEvaluationResult, mockObjectives)

      // Add second evaluation with different score
      const secondEvaluation = {
        ...mockEvaluationResult,
        timestamp: new Date(),
        objectiveResults: {
          ...mockEvaluationResult.objectiveResults,
          correctness: {
            ...mockEvaluationResult.objectiveResults.correctness,
            score: 0.9,
          },
        },
      }

      const objective = mockObjectives[0]
      const metrics = engine.calculateObjectiveMetrics(
        objective,
        secondEvaluation.objectiveResults.correctness,
        mockContext,
      )

      expect(metrics.improvement).toBeCloseTo(0.9 - 0.8, 5) // 0.1 improvement from first evaluation
    })
  })

  describe('contextual fit calculation', () => {
    test('should calculate higher fit for safety in crisis context', () => {
      const crisisContext = {
        ...mockContext,
        detectedContext: ContextType.CRISIS,
      }

      const safetyObjective = mockObjectives[2] // safety
      const evaluationResult = mockEvaluationResult.objectiveResults.safety
      const metrics = engine.calculateObjectiveMetrics(
        safetyObjective,
        evaluationResult,
        crisisContext,
      )

      expect(metrics.contextualFit).toBeGreaterThan(0.5)
    })

    test('should calculate higher fit for correctness in clinical context', () => {
      const clinicalContext = {
        ...mockContext,
        detectedContext: ContextType.CLINICAL_ASSESSMENT,
      }

      const correctnessObjective = mockObjectives[0] // correctness
      const evaluationResult = mockEvaluationResult.objectiveResults.correctness
      const metrics = engine.calculateObjectiveMetrics(
        correctnessObjective,
        evaluationResult,
        clinicalContext,
      )

      expect(metrics.contextualFit).toBeGreaterThan(0.5)
    })
  })

  describe('reliability and consistency calculations', () => {
    test('should calculate higher reliability with consistent scores', () => {
      // Add multiple evaluations with similar scores
      for (let i = 0; i < 5; i++) {
        const evaluation = {
          ...mockEvaluationResult,
          timestamp: new Date(Date.now() + i * 1000),
          objectiveResults: {
            ...mockEvaluationResult.objectiveResults,
            correctness: {
              ...mockEvaluationResult.objectiveResults.correctness,
              score: 0.8 + (Math.random() * 0.02 - 0.01), // Very small variation
            },
          },
        }
        engine.addEvaluation(evaluation, mockObjectives)
      }

      const objective = mockObjectives[0]
      const evaluationResult = mockEvaluationResult.objectiveResults.correctness
      const metrics = engine.calculateObjectiveMetrics(
        objective,
        evaluationResult,
        mockContext,
      )

      expect(metrics.reliability).toBeGreaterThan(0.7) // High reliability
      expect(metrics.consistency).toBeGreaterThan(0.7) // High consistency
    })

    test('should calculate lower reliability with inconsistent scores', () => {
      // Add multiple evaluations with varying scores
      const scores = [0.3, 0.9, 0.4, 0.8, 0.2]
      for (let i = 0; i < scores.length; i++) {
        const evaluation = {
          ...mockEvaluationResult,
          timestamp: new Date(Date.now() + i * 1000),
          objectiveResults: {
            ...mockEvaluationResult.objectiveResults,
            correctness: {
              ...mockEvaluationResult.objectiveResults.correctness,
              score: scores[i],
            },
          },
        }
        engine.addEvaluation(evaluation, mockObjectives)
      }

      const objective = mockObjectives[0]
      const evaluationResult = mockEvaluationResult.objectiveResults.correctness
      const metrics = engine.calculateObjectiveMetrics(
        objective,
        evaluationResult,
        mockContext,
      )

      expect(metrics.reliability).toBeLessThan(0.8) // Lower reliability
      expect(metrics.consistency).toBeLessThan(0.8) // Lower consistency
    })
  })

  describe('benchmarks', () => {
    test('should track benchmark achievement rates', () => {
      // Add evaluations with varying performance
      const scores = [0.9, 0.7, 0.85, 0.6, 0.95] // 3/5 above 0.8 threshold
      for (let i = 0; i < scores.length; i++) {
        const evaluation = {
          ...mockEvaluationResult,
          overallScore: scores[i],
          timestamp: new Date(Date.now() + i * 1000),
        }
        engine.addEvaluation(evaluation, mockObjectives)
      }

      const benchmarks = engine.getBenchmarks()
      const highPerformanceBenchmark = benchmarks.find(
        (b) => b.name === 'High Performance',
      )

      expect(highPerformanceBenchmark).toBeDefined()
      expect(highPerformanceBenchmark!.achievementRate).toBeCloseTo(0.6, 1) // 3/5 = 0.6
    })
  })

  describe('edge cases', () => {
    test('should handle empty evaluation results gracefully', () => {
      const emptyEvaluation: AlignmentEvaluationResult = {
        overallScore: 0,
        objectiveResults: {},
        aggregationMethod: AggregationMethod.WEIGHTED_AVERAGE,
        evaluationContext: mockContext,
        timestamp: new Date(),
        weights: {},
        normalizedScores: {},
      }

      const metrics = engine.calculateAlignmentMetrics(emptyEvaluation, [])

      expect(metrics.overallScore).toBe(0)
      expect(Object.keys(metrics.objectiveMetrics)).toHaveLength(0)
      expect(metrics.balanceScore).toBe(0)
    })

    test('should handle missing criteria scores gracefully', () => {
      const objectiveWithMissingCriteria = {
        ...mockObjectives[0],
        criteria: [
          {
            criterion: 'missing_criterion',
            description: 'A criterion with missing score',
            weight: 1.0,
          },
        ],
      }

      const evaluationResult = {
        ...mockEvaluationResult.objectiveResults.correctness,
        criteriaScores: {}, // No scores for criteria
      }

      const metrics = engine.calculateObjectiveMetrics(
        objectiveWithMissingCriteria,
        evaluationResult,
        mockContext,
      )

      expect(metrics.criteriaBreakdown).toHaveLength(1)
      expect(metrics.criteriaBreakdown[0].score).toBe(0)
      expect(metrics.criteriaBreakdown[0].contribution).toBe(0)
    })
  })
})

describe('DEFAULT_METRICS_CONFIG', () => {
  test('should have reasonable default values', () => {
    expect(DEFAULT_METRICS_CONFIG.historyWindow).toBeGreaterThan(0)
    expect(DEFAULT_METRICS_CONFIG.trendSensitivity).toBeGreaterThan(0)
    expect(DEFAULT_METRICS_CONFIG.trendSensitivity).toBeLessThan(1)
    expect(DEFAULT_METRICS_CONFIG.weightDecay).toBeGreaterThan(0)
    expect(DEFAULT_METRICS_CONFIG.weightDecay).toBeLessThanOrEqual(1)
    expect(DEFAULT_METRICS_CONFIG.confidenceThreshold).toBeGreaterThan(0)
    expect(DEFAULT_METRICS_CONFIG.confidenceThreshold).toBeLessThanOrEqual(1)

    expect(DEFAULT_METRICS_CONFIG.benchmarkThresholds).toBeDefined()
    expect(
      DEFAULT_METRICS_CONFIG.benchmarkThresholds.excellent,
    ).toBeGreaterThan(DEFAULT_METRICS_CONFIG.benchmarkThresholds.good)
    expect(DEFAULT_METRICS_CONFIG.benchmarkThresholds.good).toBeGreaterThan(
      DEFAULT_METRICS_CONFIG.benchmarkThresholds.acceptable,
    )
  })
})
