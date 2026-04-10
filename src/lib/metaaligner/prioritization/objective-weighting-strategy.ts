// Dynamic Objective Weighting Algorithms for Context-Sensitive Alignment
// Provides strategy-based weighting adjustment based on context, urgency, and extensible factors.

import type { ObjectivePriority } from './context-objective-mapping'

export interface WeightingParams {
  urgency?: 'low' | 'medium' | 'high' | 'critical'
  needsSpecialHandling?: boolean
  customFactors?: Record<string, number>
}

export interface ObjectiveWeightingStrategy {
  (
    objectives: ObjectivePriority[],
    params: WeightingParams,
  ): ObjectivePriority[]
}

/**
 * Default dynamic weighting algorithm.
 * - Boosts safety/emp.
 * - Normalizes all weights to sum=1.
 * - Users can provide custom adjustment functions.
 */
export const defaultWeightingStrategy: ObjectiveWeightingStrategy = (
  objectives,
  params,
) => {
  let adjusted = [...objectives]

  // Example: Boost weighting of safety & empathy if high urgency or special protocols
  if (
    params.urgency === 'high' ||
    params.urgency === 'critical' ||
    params.needsSpecialHandling
  ) {
    adjusted = adjusted.map((obj) => {
      if (['safety', 'empathy'].includes(obj.key)) {
        return { ...obj, weight: Math.min(1, obj.weight * 1.2) }
      }
      return obj
    })
  }

  // Custom user factors (extensible for future needs)
  if (params.customFactors) {
    adjusted = adjusted.map((obj) =>
      obj.key in params.customFactors
        ? { ...obj, weight: obj.weight * (params.customFactors![obj.key] || 1) }
        : obj,
    )
  }

  // Normalize so weights sum to 1
  const sum = adjusted.reduce((acc, obj) => acc + obj.weight, 0) || 1
  adjusted = adjusted.map((obj) => ({
    ...obj,
    weight: Number((obj.weight / sum).toFixed(4)),
  }))

  return adjusted
}
