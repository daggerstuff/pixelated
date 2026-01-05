/**
 * Objective weighting and balancing algorithms for MetaAligner
 * Provides dynamic weight calculation and multi-objective balancing
 */

import {
  ObjectiveDefinition,
  AlignmentContext,
  ContextType,
} from './objectives'
import {
  AggregationMethod,
  NormalizationMethod,
  ObjectiveConfiguration,
  ObjectiveEvaluationResult,
  AlignmentEvaluationResult,
} from './objective-interfaces'

/**
 * Context-based weight adjustment strategies
 */
export enum WeightingStrategy {
  STATIC = 'static',
  CONTEXTUAL = 'contextual',
  ADAPTIVE = 'adaptive',
  PRIORITY_BASED = 'priority_based',
  PERFORMANCE_BASED = 'performance_based',
  USER_PREFERENCE_ADJUSTED = 'user_preference_adjusted', // New strategy
}

/**
 * Weight adjustment parameters
 */
export interface WeightAdjustmentParams {
  strategy: WeightingStrategy
  contextSensitivity: number // 0-1, how much context affects weights
  adaptationRate: number // 0-1, how quickly weights adapt
  performanceWindow: number // number of evaluations to consider for performance-based weighting
  priorityThreshold: number // threshold for priority-based adjustments
}

/**
 * Weight calculation result
 */
export interface WeightCalculationResult {
  weights: Record<string, number>
  // adjustmentFactors: Record<string, number> // No longer directly applicable
  strategy: WeightingStrategy
  confidence: number
  metadata: WeightCalculationMetadata
}

export interface WeightCalculationMetadata {
  calculationTime: number
  contextFactors: string[]
  adjustmentHistory?: WeightAdjustment[]
}

export interface WeightAdjustment {
  timestamp: Date
  objectiveId: string
  previousWeight: number
  newWeight: number
  reason: string
}

/**
 * Objective weighting engine
 */
import { getContextualObjectiveWeights } from '../prioritization/context-objective-mapper'

export class ObjectiveWeightingEngine {
  private adjustmentParams: WeightAdjustmentParams
  private performanceHistory: Map<string, number[]> = new Map()
  private adjustmentHistory: WeightAdjustment[] = []

  constructor(adjustmentParams: WeightAdjustmentParams) {
    this.adjustmentParams = adjustmentParams
  }

  /**
   * Calculate weights for objectives based on context and strategy
   */
  calculateWeights(
    objectives: ObjectiveDefinition[],
    context: AlignmentContext,
    config: ObjectiveConfiguration,
  ): WeightCalculationResult {
    const startTime = Date.now()
    const baseWeights = this.getBaseWeights(objectives, config)

    let adjustedWeights: Record<string, number>
    // let adjustmentFactors: Record<string, number> = {} // No longer directly applicable
    let contextFactors: string[] = []

    switch (this.adjustmentParams.strategy) {
      case WeightingStrategy.STATIC:
        adjustedWeights = baseWeights
        break

      case WeightingStrategy.CONTEXTUAL: {
        const contextResult = this.applyContextualWeighting(
          baseWeights, // baseWeights might be used for blending in the future
          context,
        )
        adjustedWeights = contextResult.weights
        // adjustmentFactors = contextResult.factors // Factors are not returned by the new method
        contextFactors = contextResult.contextFactors
        break
      }

      case WeightingStrategy.ADAPTIVE:
        adjustedWeights = this.applyAdaptiveWeighting(baseWeights, context)
        break

      case WeightingStrategy.PRIORITY_BASED:
        adjustedWeights = this.applyPriorityBasedWeighting(baseWeights, context)
        break

      case WeightingStrategy.PERFORMANCE_BASED:
        adjustedWeights = this.applyPerformanceBasedWeighting(
          baseWeights,
          objectives,
        )
        break

      case WeightingStrategy.USER_PREFERENCE_ADJUSTED:
        adjustedWeights = this.applyUserPreferenceWeighting(
          baseWeights,
          context,
        )
        contextFactors.push('user_preferences_applied') // Add a factor indicating preferences were used
        break

      default:
        adjustedWeights = baseWeights
    }

    // Normalize weights to ensure they sum to 1
    adjustedWeights = this.normalizeWeights(adjustedWeights)

    // Record adjustments
    this.recordWeightAdjustments(baseWeights, adjustedWeights)

    return {
      weights: adjustedWeights,
      // adjustmentFactors, // No longer directly applicable
      strategy: this.adjustmentParams.strategy,
      confidence: this.calculateWeightConfidence(adjustedWeights, context),
      metadata: {
        calculationTime: Date.now() - startTime,
        contextFactors,
        adjustmentHistory: [...this.adjustmentHistory],
      },
    }
  }

  private getBaseWeights(
    objectives: ObjectiveDefinition[],
    config: ObjectiveConfiguration,
  ): Record<string, number> {
    const weights: Record<string, number> = {}

    for (const objective of objectives) {
      weights[objective.id] =
        config.objectives[objective.id] ?? objective.weight
    }

    return weights
  }

  private applyContextualWeighting(
    baseWeights: Record<string, number>,
    context: AlignmentContext,
  ): {
    weights: Record<string, number>
    // factors are no longer directly applicable with the new system
    contextFactors: string[]
  } {
    const contextFactors: string[] = [context.detectedContext]
    // Get weights directly from the new mapping system
    const contextualWeights = getContextualObjectiveWeights(
      context.detectedContext,
    )

    // The baseWeights and contextSensitivity might still be used to further adjust
    // these contextualWeights if needed, or this part can be simplified if
    // getContextualObjectiveWeights is considered authoritative.
    // For now, let's assume getContextualObjectiveWeights provides the final weights for the context.
    // If further adjustments based on baseWeights or sensitivity are needed, this logic would change.
    // This simplification means adjustmentFactors might not be relevant anymore.

    // Mixin with baseWeights according to sensitivity?
    // Example: weights[objId] = baseWeights[objId] * (1-sensitivity) + contextualWeights[objId] * sensitivity
    // For now, directly using contextualWeights:
    const finalWeights: Record<string, number> = {}
    for (const objectiveId in baseWeights) {
      // Iterate to ensure all objectives are covered
      finalWeights[objectiveId] =
        contextualWeights[objectiveId] !== undefined
          ? contextualWeights[objectiveId]!
          : baseWeights[objectiveId]! // Fallback to base if not in contextual
    }

    return { weights: finalWeights, contextFactors }
  }

  private applyUserPreferenceWeighting(
    baseWeights: Record<string, number>,
    context: AlignmentContext,
  ): Record<string, number> {
    // Start from contextual weights to align with expectations in tests
    const contextual = getContextualObjectiveWeights(context.detectedContext)
    const weights: Record<string, number> = {}
    // Ensure all objectives are represented; fall back to base when missing
    for (const [objectiveId, base] of Object.entries(baseWeights)) {
      weights[objectiveId] =
        (contextual as Record<string, number>)[objectiveId] ?? base
    }
    const { userProfile } = context

    if (userProfile?.preferences?.objectiveWeightAdjustments) {
      for (const [objectiveId, multiplier] of Object.entries(
        userProfile.preferences.objectiveWeightAdjustments,
      )) {
        if (weights[objectiveId] !== undefined) {
          weights[objectiveId] *= multiplier
        }
      }
    }

    // Handling preferredObjectives with preferenceStrength - this might involve more complex logic.
    // For now, we can interpret preferenceStrength as a direct multiplier or a factor in a blend.
    // Example: a simple multiplier approach (could be refined)
    if (userProfile?.preferences?.preferredObjectives) {
      for (const pref of userProfile.preferences.preferredObjectives) {
        if (weights[pref.objectiveId] !== undefined) {
          // Ensure preferenceStrength is a positive multiplier; adjust as needed for your logic
          // For example, map 0-1 strength to a 1.0-2.0 multiplier range, or use it to blend.
          // Simple example: treat strength as a direct boost factor (1 + strength).
          // This interpretation may need refinement based on desired behavior.
          weights[pref.objectiveId] *= 1 + pref.preferenceStrength
        }
      }
    }
    return weights
  }

  private applyAdaptiveWeighting(
    baseWeights: Record<string, number>,
    _context: AlignmentContext,
  ): Record<string, number> {
    const weights = { ...baseWeights }

    // Adaptive weighting based on recent performance and context changes
    for (const [objectiveId, baseWeight] of Object.entries(baseWeights)) {
      const performanceHistory = this.performanceHistory.get(objectiveId) || []

      if (performanceHistory.length > 0) {
        const recentPerformance = performanceHistory.slice(-5) // Last 5 evaluations
        const avgPerformance =
          recentPerformance.reduce((sum, score) => sum + score, 0) /
          recentPerformance.length

        // Adjust weight based on performance (lower performing objectives get higher weight)
        const performanceAdjustment =
          (1.0 - avgPerformance) * this.adjustmentParams.adaptationRate
        weights[objectiveId] = Math.max(
          0.01,
          baseWeight + performanceAdjustment,
        )
      }
    }

    return weights
  }

  private applyPriorityBasedWeighting(
    baseWeights: Record<string, number>,
    context: AlignmentContext,
  ): Record<string, number> {
    const weights = { ...baseWeights }

    // Identify priority objectives based on context
    const priorityObjectives = this.identifyPriorityObjectives(context)

    for (const objectiveId of priorityObjectives) {
      if (weights[objectiveId]) {
        weights[objectiveId] *= 1.0 + this.adjustmentParams.priorityThreshold
      }
    }

    return weights
  }

  private applyPerformanceBasedWeighting(
    baseWeights: Record<string, number>,
    objectives: ObjectiveDefinition[],
  ): Record<string, number> {
    const weights = { ...baseWeights }

    for (const objective of objectives) {
      const history = this.performanceHistory.get(objective.id) || []

      if (history.length >= this.adjustmentParams.performanceWindow) {
        const recentHistory = history.slice(
          -this.adjustmentParams.performanceWindow,
        )
        const avgScore =
          recentHistory.reduce((sum, score) => sum + score, 0) /
          recentHistory.length

        // Increase weight for consistently underperforming objectives
        if (avgScore < 0.7) {
          weights[objective.id] *= 1.2
        }
      }
    }

    return weights
  }

  // This method is no longer needed as context.detectedContext is used directly
  // private determineContextType(
  //   context: AlignmentContext,
  // ): keyof ContextWeightMultipliers {
  //   // Use the detected context type from the context object
  //   switch (context.detectedContext) {
  //     case ContextType.CRISIS:
  //       return 'crisis'
  //     case ContextType.EDUCATIONAL:
  //       return 'educational'
  //     case ContextType.SUPPORT:
  //       return 'support'
  //     case ContextType.CLINICAL_ASSESSMENT:
  //       return 'clinical'
  //     case ContextType.INFORMATIONAL:
  //       return 'informational'
  //     default:
  //       return 'default'
  //   }
  // }

  private identifyPriorityObjectives(context: AlignmentContext): string[] {
    const priorities: string[] = []

    switch (context.detectedContext) {
      case ContextType.CRISIS:
        priorities.push('safety', 'empathy')
        break
      case ContextType.SUPPORT:
        priorities.push('empathy', 'safety')
        break
      case ContextType.INFORMATIONAL:
        priorities.push('correctness', 'informativeness')
        break
      case ContextType.CLINICAL_ASSESSMENT:
        priorities.push('correctness', 'professionalism')
        break
      case ContextType.EDUCATIONAL:
        priorities.push('informativeness', 'correctness')
        break
      case ContextType.GENERAL:
      default:
        // GENERAL and fallback: Make all objectives equal priority to encourage balanced evaluation.
        priorities.push(
          'empathy',
          'safety',
          'correctness',
          'professionalism',
          'informativeness',
        )
        break
    }

    return priorities
  }

  private normalizeWeights(
    weights: Record<string, number>,
  ): Record<string, number> {
    const total = Object.values(weights).reduce(
      (sum, weight) => sum + weight,
      0,
    )

    if (total === 0) {
      // Equal weights if all are zero
      const equalWeight = 1.0 / Object.keys(weights).length
      return Object.keys(weights).reduce(
        (normalized, id) => {
          normalized[id] = equalWeight
          return normalized
        },
        {} as Record<string, number>,
      )
    }

    const normalized: Record<string, number> = {}
    for (const [id, weight] of Object.entries(weights)) {
      normalized[id] = weight / total
    }

    return normalized
  }

  private calculateWeightConfidence(
    weights: Record<string, number>,
    context: AlignmentContext,
  ): number {
    // Calculate confidence based on context clarity and weight distribution
    const weightVariance = this.calculateWeightVariance(weights)
    const contextClarity = this.calculateContextClarity(context)

    // Higher confidence with clearer context and more balanced weights
    return Math.min(1.0, contextClarity * (1.0 - weightVariance))
  }

  private calculateWeightVariance(weights: Record<string, number>): number {
    const values = Object.values(weights)
    const mean = values.reduce((sum, weight) => sum + weight, 0) / values.length
    const variance =
      values.reduce((sum, weight) => sum + Math.pow(weight - mean, 2), 0) /
      values.length
    return Math.sqrt(variance)
  }

  private calculateContextClarity(context: AlignmentContext): number {
    // Simple heuristic for context clarity
    let clarity = 0.5 // Base clarity

    switch (context.detectedContext) {
      case ContextType.CRISIS:
        clarity += 0.3
        break
      case ContextType.CLINICAL_ASSESSMENT:
        clarity += 0.2
        break
      case ContextType.EDUCATIONAL:
        clarity += 0.1
        break
    }

    return Math.min(1.0, clarity)
  }

  private recordWeightAdjustments(
    baseWeights: Record<string, number>,
    adjustedWeights: Record<string, number>,
  ): void {
    const timestamp = new Date()

    for (const [objectiveId, adjustedWeight] of Object.entries(
      adjustedWeights,
    )) {
      const baseWeight = baseWeights[objectiveId]

      if (Math.abs(adjustedWeight - baseWeight) > 0.01) {
        this.adjustmentHistory.push({
          timestamp,
          objectiveId,
          previousWeight: baseWeight,
          newWeight: adjustedWeight,
          reason: `${this.adjustmentParams.strategy} adjustment`,
        })
      }
    }

    // Keep only recent history
    if (this.adjustmentHistory.length > 100) {
      this.adjustmentHistory = this.adjustmentHistory.slice(-50)
    }
  }

  /**
   * Update performance history for objectives
   */
  updatePerformanceHistory(objectiveId: string, score: number): void {
    if (!this.performanceHistory.has(objectiveId)) {
      this.performanceHistory.set(objectiveId, [])
    }

    const history = this.performanceHistory.get(objectiveId)!
    history.push(score)

    // Keep only recent history
    if (history.length > this.adjustmentParams.performanceWindow * 2) {
      history.splice(
        0,
        history.length - this.adjustmentParams.performanceWindow,
      )
    }
  }
}

/**
 * Multi-objective balancing algorithms
 */
export const ObjectiveBalancer = {
  /**
   * Balance multiple objective scores using specified aggregation method
   */
  balance(
    evaluationResults: Record<string, ObjectiveEvaluationResult>,
    weights: Record<string, number>,
    method: AggregationMethod,
    normalizationMethod: NormalizationMethod = NormalizationMethod.NONE,
  ): AlignmentEvaluationResult {
    const scores = this.extractScores(evaluationResults)
    const normalizedScores = this.normalizeScores(scores, normalizationMethod)

    const overallScore = this.aggregateScores(normalizedScores, weights, method)

    return {
      overallScore,
      objectiveResults: evaluationResults,
      weights,
      normalizedScores,
      aggregationMethod: method,
      evaluationContext: {
        userQuery: '',
        detectedContext: ContextType.GENERAL,
      },
      timestamp: new Date(),
    }
  },

  extractScores(
    evaluationResults: Record<string, ObjectiveEvaluationResult>,
  ): Record<string, number> {
    const scores: Record<string, number> = {}

    for (const [objectiveId, result] of Object.entries(evaluationResults)) {
      scores[objectiveId] = result.score
    }

    return scores
  },

  normalizeScores(
    scores: Record<string, number>,
    method: NormalizationMethod,
  ): Record<string, number> {
    switch (method) {
      case NormalizationMethod.NONE:
        return scores

      case NormalizationMethod.MIN_MAX:
        return this.minMaxNormalize(scores)

      case NormalizationMethod.Z_SCORE:
        return this.zScoreNormalize(scores)

      case NormalizationMethod.SIGMOID:
        return this.sigmoidNormalize(scores)
    }
  },

  minMaxNormalize(scores: Record<string, number>): Record<string, number> {
    const values = Object.values(scores)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min

    if (range === 0) {
      return scores
    }

    const normalized: Record<string, number> = {}
    for (const [id, score] of Object.entries(scores)) {
      normalized[id] = (score - min) / range
    }

    return normalized
  },

  zScoreNormalize(scores: Record<string, number>): Record<string, number> {
    const values = Object.values(scores)
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length
    const stdDev = Math.sqrt(variance)

    if (stdDev === 0) {
      return scores
    }

    const normalized: Record<string, number> = {}
    for (const [id, score] of Object.entries(scores)) {
      normalized[id] = (score - mean) / stdDev
    }

    return normalized
  },

  sigmoidNormalize(scores: Record<string, number>): Record<string, number> {
    const normalized: Record<string, number> = {}

    for (const [id, score] of Object.entries(scores)) {
      normalized[id] = 1 / (1 + Math.exp(-score))
    }

    return normalized
  },

  aggregateScores(
    scores: Record<string, number>,
    weights: Record<string, number>,
    method: AggregationMethod,
  ): number {
    switch (method) {
      case AggregationMethod.WEIGHTED_AVERAGE:
        return this.weightedAverage(scores, weights)

      case AggregationMethod.WEIGHTED_SUM:
        return this.weightedSum(scores, weights)

      case AggregationMethod.HARMONIC_MEAN:
        return this.harmonicMean(scores, weights)

      case AggregationMethod.GEOMETRIC_MEAN:
        return this.geometricMean(scores, weights)

      default:
        return this.weightedAverage(scores, weights)
    }
  },

  weightedAverage(
    scores: Record<string, number>,
    weights: Record<string, number>,
  ): number {
    let weightedSum = 0
    let totalWeight = 0

    for (const [id, score] of Object.entries(scores)) {
      const weight = weights[id] || 0
      weightedSum += score * weight
      totalWeight += weight
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0
  },

  weightedSum(
    scores: Record<string, number>,
    weights: Record<string, number>,
  ): number {
    let sum = 0

    for (const [id, score] of Object.entries(scores)) {
      const weight = weights[id] || 0
      sum += score * weight
    }

    return sum
  },

  harmonicMean(
    scores: Record<string, number>,
    weights: Record<string, number>,
  ): number {
    let weightedSum = 0
    let totalWeight = 0

    for (const [id, score] of Object.entries(scores)) {
      const weight = weights[id] || 0
      if (score > 0) {
        weightedSum += weight / score
        totalWeight += weight
      }
    }

    return totalWeight > 0 && weightedSum > 0 ? totalWeight / weightedSum : 0
  },

  geometricMean(
    scores: Record<string, number>,
    weights: Record<string, number>,
  ): number {
    let logSum = 0
    let totalWeight = 0

    for (const [id, score] of Object.entries(scores)) {
      const weight = weights[id] || 0
      if (score > 0) {
        logSum += weight * Math.log(score)
        totalWeight += weight
      }
    }

    return totalWeight > 0 ? Math.exp(logSum / totalWeight) : 0
  },
}

// DEFAULT_CONTEXT_MULTIPLIERS is no longer needed as weights are now sourced from
// context-objective-mapper.ts

/**
 * Default weight adjustment parameters
 */
export const DEFAULT_WEIGHT_ADJUSTMENT_PARAMS: WeightAdjustmentParams = {
  strategy: WeightingStrategy.CONTEXTUAL,
  contextSensitivity: 0.7,
  adaptationRate: 0.3,
  performanceWindow: 10,
  priorityThreshold: 0.2,
}
