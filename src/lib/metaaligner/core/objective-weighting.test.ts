/**
 * Unit tests for objective weighting and balancing algorithms
 */

import { describe, it as test, expect, beforeEach } from 'vitest'
import {
  ObjectiveWeightingEngine,
  ObjectiveBalancer,
  WeightingStrategy,
  // DEFAULT_CONTEXT_MULTIPLIERS, // No longer used
  DEFAULT_WEIGHT_ADJUSTMENT_PARAMS,
} from './objective-weighting'
import {
  AggregationMethod,
  NormalizationMethod,
  ObjectiveConfiguration,
  ObjectiveEvaluationResult,
} from './objective-interfaces'
import {
  ObjectiveDefinition,
  AlignmentContext,
  ContextType,
  UserProfile, // Import UserProfile
} from './objectives'

describe('ObjectiveWeightingEngine', () => {
  let engine: ObjectiveWeightingEngine
  let mockObjectives: ObjectiveDefinition[]
  let mockContext: AlignmentContext
  let mockConfig: ObjectiveConfiguration

  beforeEach(() => {
    // engine = new ObjectiveWeightingEngine( // Old instantiation
    //   DEFAULT_CONTEXT_MULTIPLIERS,
    //   DEFAULT_WEIGHT_ADJUSTMENT_PARAMS,
    // )
    engine = new ObjectiveWeightingEngine(DEFAULT_WEIGHT_ADJUSTMENT_PARAMS)

    mockObjectives = [
      {
        id: 'correctness',
        name: 'Correctness',
        description: 'Test correctness',
        weight: 1.0 / 3.0, // 0.333...
        criteria: [],
        evaluationFunction: () => 0.8,
      },
      {
        id: 'empathy',
        name: 'Empathy',
        description: 'Test empathy',
        weight: 1.0 / 3.0, // 0.333...
        criteria: [],
        evaluationFunction: () => 0.7,
      },
      {
        id: 'safety',
        name: 'Safety',
        description: 'Test safety',
        weight: 1.0 / 3.0, // 0.333...
        criteria: [],
        evaluationFunction: () => 0.9,
      },
    ]

    mockContext = {
      userQuery: 'I need help',
      detectedContext: ContextType.SUPPORT,
      conversationHistory: [],
      sessionMetadata: {},
      userProfile: undefined, // Initialize with no profile for most tests
    }

    mockConfig = {
      objectives: {
        correctness: 1.0 / 3.0,
        empathy: 1.0 / 3.0,
        safety: 1.0 / 3.0,
      },
      contextualWeights: {},
      globalSettings: {
        enableDynamicWeighting: true,
        enableContextualAdjustment: true,
        minObjectiveScore: 0.0,
        maxObjectiveScore: 1.0,
        normalizationMethod: NormalizationMethod.NONE,
        aggregationMethod: AggregationMethod.WEIGHTED_AVERAGE,
      },
    }
  })

  describe('calculateWeights', () => {
    test('should return static weights when using STATIC strategy', () => {
      const staticEngine = new ObjectiveWeightingEngine({
        // Updated instantiation
        ...DEFAULT_WEIGHT_ADJUSTMENT_PARAMS,
        strategy: WeightingStrategy.STATIC,
      })

      const result = staticEngine.calculateWeights(
        mockObjectives,
        mockContext,
        mockConfig,
      )
      const expectedWeight = 1.0 / 3.0

      expect(result.strategy).toBe(WeightingStrategy.STATIC)
      expect(result.weights['correctness']!).toBeCloseTo(expectedWeight, 5)
      expect(result.weights['empathy']!).toBeCloseTo(expectedWeight, 5)
      expect(result.weights['safety']!).toBeCloseTo(expectedWeight, 5)
    })

    test('should adjust weights based on context when using CONTEXTUAL strategy', () => {
      const crisisContext = {
        ...mockContext,
        detectedContext: ContextType.CRISIS,
      }

      const result = engine.calculateWeights(
        mockObjectives,
        crisisContext,
        mockConfig,
      )

      expect(result.strategy).toBe(WeightingStrategy.CONTEXTUAL)
      // In crisis context, safety and empathy should get higher weights
      expect(result.weights['safety']!).toBeGreaterThan(
        result.weights['correctness']!,
      )
      expect(result.weights['empathy']!).toBeGreaterThan(
        result.weights['correctness']!,
      )
    })

    test('should normalize weights to sum to 1', () => {
      const result = engine.calculateWeights(
        mockObjectives,
        mockContext,
        mockConfig,
      )

      const totalWeight = Object.values(result.weights).reduce(
        (sum, weight) => sum + weight,
        0,
      )
      expect(totalWeight).toBeCloseTo(1.0, 5)
    })

    test('should return confidence score', () => {
      const result = engine.calculateWeights(
        mockObjectives,
        mockContext,
        mockConfig,
      )

      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    })

    test('should include metadata in result', () => {
      const result = engine.calculateWeights(
        mockObjectives,
        mockContext,
        mockConfig,
      )

      expect(result.metadata).toBeDefined()
      expect(result.metadata.calculationTime).toBeGreaterThanOrEqual(0)
      expect(result.metadata.contextFactors).toBeInstanceOf(Array)
    })

    test('should apply user preferences when USER_PREFERENCE_ADJUSTED strategy is used', () => {
      const userProfileWithPrefs: UserProfile = {
        preferences: {
          objectiveWeightAdjustments: { empathy: 1.5, safety: 0.8 }, // Boost empathy, reduce safety
          preferredObjectives: [
            { objectiveId: 'correctness', preferenceStrength: 0.5 },
          ], // Prefer correctness
        },
      }
      const contextWithUserPrefs: AlignmentContext = {
        ...mockContext,
        userProfile: userProfileWithPrefs,
      }
      const userPrefEngine = new ObjectiveWeightingEngine({
        ...DEFAULT_WEIGHT_ADJUSTMENT_PARAMS,
        strategy: WeightingStrategy.USER_PREFERENCE_ADJUSTED,
      })

      const initialWeights = userPrefEngine.calculateWeights(
        mockObjectives,
        { ...contextWithUserPrefs, userProfile: undefined }, // Calculate without prefs first for comparison
        mockConfig,
      ).weights

      const result = userPrefEngine.calculateWeights(
        mockObjectives,
        contextWithUserPrefs,
        mockConfig,
      )

      expect(result.strategy).toBe(WeightingStrategy.USER_PREFERENCE_ADJUSTED)
      // Empathy should be higher due to objectiveWeightAdjustments
      // Correctness should be higher due to preferredObjectives
      // Safety should be lower
      // Note: These are relative comparisons before normalization.
      // The exact values after normalization depend on all combined effects.

      // To make this test more robust, we need to check the relative change or
      // pre-calculate expected values if the preference application logic is very specific.
      // For now, we check if the direction of adjustment is as expected for some objectives.
      // Need to compare against a baseline where preferences are NOT applied but other factors are similar.
      // The baseWeights from mockConfig are all equal (1/3).

      // Example: Empathy's weight with prefs should be > its weight without prefs (if strategy was static/default)
      // This is a simplified check; a more detailed check would involve isolating the preference effect.
      // expect(result.weights.empathy).toBeGreaterThan(initialWeights.empathy! * 1.5 * 0.9) // Allow some margin for normalization
      // expect(result.weights.correctness).toBeGreaterThan(initialWeights.correctness! * 1.5 * 0.9)
      // expect(result.weights.safety).toBeLessThan(initialWeights.safety! * 0.8 * 1.1)

      // Check ratios:
      // Empathy was boosted by 1.5 (from objectiveWeightAdjustments)
      // Correctness was boosted by (1 + 0.5) = 1.5 (from preferredObjectives)
      // Safety was reduced by 0.8 (from objectiveWeightAdjustments)

      // Ratio of empathy to an unadjusted objective (if one existed) would increase by ~1.5
      // Ratio of empathy to safety: (initialE * 1.5) / (initialS * 0.8)
      const empathySafetyRatioInitial =
        initialWeights.empathy! / initialWeights.safety!
      const empathySafetyRatioFinal =
        result.weights['empathy']! / result.weights['safety']!
      expect(empathySafetyRatioFinal).toBeCloseTo(
        empathySafetyRatioInitial * (1.5 / 0.8),
        1,
      )

      const correctnessSafetyRatioInitial =
        initialWeights.correctness! / initialWeights.safety!
      const correctnessSafetyRatioFinal =
        result.weights['correctness']! / result.weights['safety']!
      // Correctness boost (1+0.5) = 1.5; Safety reduction 0.8
      expect(correctnessSafetyRatioFinal).toBeCloseTo(
        correctnessSafetyRatioInitial * (1.5 / 0.8),
        1,
      )

      const totalWeight = Object.values(result.weights).reduce(
        (sum, w) => sum + w,
        0,
      )
      expect(totalWeight).toBeCloseTo(1.0, 5)
      expect(result.metadata.contextFactors).toContain(
        'user_preferences_applied',
      )
    })
  })

  describe('updatePerformanceHistory', () => {
    test('should store performance scores for objectives', () => {
      engine.updatePerformanceHistory('correctness', 0.8)
      engine.updatePerformanceHistory('correctness', 0.7)

      // Performance history is private, but we can test its effect on adaptive weighting
      const adaptiveEngine = new ObjectiveWeightingEngine({
        // Updated instantiation
        ...DEFAULT_WEIGHT_ADJUSTMENT_PARAMS,
        strategy: WeightingStrategy.ADAPTIVE,
      })

      adaptiveEngine.updatePerformanceHistory('correctness', 0.5) // Low performance
      const result = adaptiveEngine.calculateWeights(
        mockObjectives,
        mockContext,
        mockConfig,
      )

      // Should work without errors
      expect(result.weights).toBeDefined()
    })
  })

  describe('priority-based weighting', () => {
    test('should increase weights for priority objectives in crisis context', () => {
      const priorityEngine = new ObjectiveWeightingEngine({
        // Updated instantiation
        ...DEFAULT_WEIGHT_ADJUSTMENT_PARAMS,
        strategy: WeightingStrategy.PRIORITY_BASED,
      })

      const crisisContext = {
        ...mockContext,
        detectedContext: ContextType.CRISIS,
      }

      const result = priorityEngine.calculateWeights(
        mockObjectives,
        crisisContext,
        mockConfig,
      )
      const baseWeight = 1.0 / 3.0

      // Safety and empathy should get priority in crisis context
      expect(result.weights['safety']!).toBeGreaterThan(baseWeight)
      expect(result.weights['empathy']!).toBeGreaterThan(baseWeight)
    })
  })
})

describe('ObjectiveBalancer', () => {
  let mockEvaluationResults: Record<string, ObjectiveEvaluationResult>
  let mockWeights: Record<string, number>

  beforeEach(() => {
    mockEvaluationResults = {
      correctness: {
        objectiveId: 'correctness',
        score: 0.8,
        criteriaScores: {},
        confidence: 0.9,
        metadata: {
          evaluationTime: 10,
          contextFactors: ['support'],
          adjustmentFactors: {},
        },
      },
      empathy: {
        objectiveId: 'empathy',
        score: 0.7,
        criteriaScores: {},
        confidence: 0.8,
        metadata: {
          evaluationTime: 12,
          contextFactors: ['support'],
          adjustmentFactors: {},
        },
      },
      safety: {
        objectiveId: 'safety',
        score: 0.9,
        criteriaScores: {},
        confidence: 0.95,
        metadata: {
          evaluationTime: 8,
          contextFactors: ['support'],
          adjustmentFactors: {},
        },
      },
    }

    mockWeights = {
      correctness: 0.3,
      empathy: 0.3,
      safety: 0.4,
    }
  })

  describe('balance', () => {
    test('should calculate weighted average correctly', () => {
      const result = ObjectiveBalancer.balance(
        mockEvaluationResults,
        mockWeights,
        AggregationMethod.WEIGHTED_AVERAGE,
      )

      // Expected: (0.8 * 0.3 + 0.7 * 0.3 + 0.9 * 0.4) / 1.0 = 0.81
      expect(result.overallScore).toBeCloseTo(0.81, 2)
      expect(result.aggregationMethod).toBe(AggregationMethod.WEIGHTED_AVERAGE)
    })

    test('should calculate weighted sum correctly', () => {
      const result = ObjectiveBalancer.balance(
        mockEvaluationResults,
        mockWeights,
        AggregationMethod.WEIGHTED_SUM,
      )

      // Expected: 0.8 * 0.3 + 0.7 * 0.3 + 0.9 * 0.4 = 0.81
      expect(result.overallScore).toBeCloseTo(0.81, 2)
      expect(result.aggregationMethod).toBe(AggregationMethod.WEIGHTED_SUM)
    })

    test('should calculate harmonic mean correctly', () => {
      const result = ObjectiveBalancer.balance(
        mockEvaluationResults,
        mockWeights,
        AggregationMethod.HARMONIC_MEAN,
      )

      expect(result.overallScore).toBeGreaterThan(0)
      expect(result.overallScore).toBeLessThan(1)
      expect(result.aggregationMethod).toBe(AggregationMethod.HARMONIC_MEAN)
    })

    test('should calculate geometric mean correctly', () => {
      const result = ObjectiveBalancer.balance(
        mockEvaluationResults,
        mockWeights,
        AggregationMethod.GEOMETRIC_MEAN,
      )

      expect(result.overallScore).toBeGreaterThan(0)
      expect(result.overallScore).toBeLessThan(1)
      expect(result.aggregationMethod).toBe(AggregationMethod.GEOMETRIC_MEAN)
    })

    test('should apply min-max normalization', () => {
      const result = ObjectiveBalancer.balance(
        mockEvaluationResults,
        mockWeights,
        AggregationMethod.WEIGHTED_AVERAGE,
        NormalizationMethod.MIN_MAX,
      )

      expect(result.normalizedScores).toBeDefined()
      const normalizedValues = Object.values(result.normalizedScores)

      // After min-max normalization, values should be between 0 and 1
      expect(Math.min(...normalizedValues)).toBeGreaterThanOrEqual(0)
      expect(Math.max(...normalizedValues)).toBeLessThanOrEqual(1)
    })

    test('should apply z-score normalization', () => {
      const result = ObjectiveBalancer.balance(
        mockEvaluationResults,
        mockWeights,
        AggregationMethod.WEIGHTED_AVERAGE,
        NormalizationMethod.Z_SCORE,
      )

      expect(result.normalizedScores).toBeDefined()
      const normalizedValues = Object.values(result.normalizedScores)

      // Z-score normalization can produce negative values
      expect(normalizedValues.length).toBe(3)
    })

    test('should apply sigmoid normalization', () => {
      const result = ObjectiveBalancer.balance(
        mockEvaluationResults,
        mockWeights,
        AggregationMethod.WEIGHTED_AVERAGE,
        NormalizationMethod.SIGMOID,
      )

      expect(result.normalizedScores).toBeDefined()
      const normalizedValues = Object.values(result.normalizedScores)

      // Sigmoid normalization should produce values between 0 and 1
      expect(Math.min(...normalizedValues)).toBeGreaterThan(0)
      expect(Math.max(...normalizedValues)).toBeLessThan(1)
    })

    test('should include all required fields in result', () => {
      const result = ObjectiveBalancer.balance(
        mockEvaluationResults,
        mockWeights,
        AggregationMethod.WEIGHTED_AVERAGE,
      )

      expect(result.overallScore).toBeDefined()
      expect(result.objectiveResults).toBe(mockEvaluationResults)
      expect(result.weights).toBe(mockWeights)
      expect(result.normalizedScores).toBeDefined()
      expect(result.aggregationMethod).toBe(AggregationMethod.WEIGHTED_AVERAGE)
      expect(result.timestamp).toBeInstanceOf(Date)
    })
  })

  describe('edge cases', () => {
    test('should handle empty evaluation results', () => {
      const result = ObjectiveBalancer.balance(
        {},
        {},
        AggregationMethod.WEIGHTED_AVERAGE,
      )

      expect(result.overallScore).toBe(0)
      expect(Object.keys(result.normalizedScores)).toHaveLength(0)
    })

    test('should handle zero weights gracefully', () => {
      const zeroWeights = {
        correctness: 0,
        empathy: 0,
        safety: 0,
      }

      const result = ObjectiveBalancer.balance(
        mockEvaluationResults,
        zeroWeights,
        AggregationMethod.WEIGHTED_AVERAGE,
      )

      expect(result.overallScore).toBe(0)
    })

    test('should handle single objective', () => {
      const singleResult = {
        correctness: mockEvaluationResults.correctness,
      }
      const singleWeight = { correctness: 1.0 }

      const result = ObjectiveBalancer.balance(
        singleResult,
        singleWeight,
        AggregationMethod.WEIGHTED_AVERAGE,
      )

      expect(result.overallScore).toBe(0.8) // Same as the single score
    })
  })
})

describe('Integration tests', () => {
  test('should work with complete weighting and balancing workflow', () => {
    const engine = new ObjectiveWeightingEngine(
      DEFAULT_WEIGHT_ADJUSTMENT_PARAMS,
    ) // Updated instantiation

    const objectives: ObjectiveDefinition[] = [
      {
        id: 'correctness',
        name: 'Correctness',
        description: 'Accuracy of information',
        weight: 0.25,
        criteria: [],
        evaluationFunction: () => 0.8,
      },
      {
        id: 'empathy',
        name: 'Empathy',
        description: 'Emotional understanding',
        weight: 0.25,
        criteria: [],
        evaluationFunction: () => 0.7,
      },
    ]

    const context: AlignmentContext = {
      userQuery: 'I am feeling anxious',
      detectedContext: ContextType.CRISIS,
      conversationHistory: [],
      sessionMetadata: {},
    }

    const config: ObjectiveConfiguration = {
      objectives: {
        correctness: 0.25,
        empathy: 0.25,
      },
      contextualWeights: {},
      globalSettings: {
        enableDynamicWeighting: true,
        enableContextualAdjustment: true,
        minObjectiveScore: 0.0,
        maxObjectiveScore: 1.0,
        normalizationMethod: NormalizationMethod.MIN_MAX,
        aggregationMethod: AggregationMethod.WEIGHTED_AVERAGE,
      },
    }

    // Calculate weights
    const weightResult = engine.calculateWeights(objectives, context, config)
    expect(weightResult.weights).toBeDefined()

    // Create mock evaluation results
    const evaluationResults: Record<string, ObjectiveEvaluationResult> = {
      correctness: {
        objectiveId: 'correctness',
        score: 0.8,
        criteriaScores: {},
        confidence: 0.9,
        metadata: {
          evaluationTime: 10,
          contextFactors: ['crisis'],
          adjustmentFactors: {},
        },
      },
      empathy: {
        objectiveId: 'empathy',
        score: 0.7,
        criteriaScores: {},
        confidence: 0.8,
        metadata: {
          evaluationTime: 12,
          contextFactors: ['crisis'],
          adjustmentFactors: {},
        },
      },
    }

    // Balance objectives
    const balanceResult = ObjectiveBalancer.balance(
      evaluationResults,
      weightResult.weights,
      AggregationMethod.WEIGHTED_AVERAGE,
      NormalizationMethod.MIN_MAX,
    )

    expect(balanceResult.overallScore).toBeGreaterThan(0)
    expect(balanceResult.overallScore).toBeLessThanOrEqual(1)
    expect(balanceResult.weights).toBe(weightResult.weights)
  })
})
