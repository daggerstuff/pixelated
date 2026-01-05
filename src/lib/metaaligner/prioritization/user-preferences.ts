// User Preferences Module for MetaAligner Objective Personalization
// Allows contextual adaptation of objective mapping and weighting with user-defined or inferred settings.

import { ObjectivePriority } from './context-objective-mapping'

export interface UserPreferences {
  preferredSupportStyle?: 'pragmatic' | 'empathic' | 'direct' | 'reflective'
  responseFormality?: 'formal' | 'informal'
  riskSensitivity?: 'low' | 'medium' | 'high'
  customObjectiveWeights?: Partial<Record<string, number>>
  disableObjectives?: string[]
  [key: string]: unknown
}

/**
 * Applies user preferences to weighting parameters for objectives.
 * - Merges custom weights, disables, or boosts objectives as needed
 * - Can be utilized by weighting strategies or the objective switcher
 */
export function applyUserPreferences(
  objectives: ObjectivePriority[],
  prefs: UserPreferences,
): ObjectivePriority[] {
  let result = [...objectives]
  // Disable objectives if specified
  if (prefs.disableObjectives && prefs.disableObjectives.length) {
    result = result.filter((obj) => !prefs.disableObjectives!.includes(obj.key))
  }
  // Custom weights override
  if (prefs.customObjectiveWeights) {
    result = result.map((obj) =>
      prefs.customObjectiveWeights![obj.key]
        ? { ...obj, weight: prefs.customObjectiveWeights![obj.key]! }
        : obj,
    )
  }
  // Example: preference-driven boost (e.g., empathy for empathic style)
  if (prefs.preferredSupportStyle === 'empathic') {
    result = result.map((obj) =>
      obj.key === 'empathy'
        ? { ...obj, weight: Math.min(obj.weight * 1.15, 1) }
        : obj,
    )
  }
  // Normalize weights to sum=1
  const sum = result.reduce((acc, obj) => acc + obj.weight, 0) || 1
  result = result.map((obj) => ({
    ...obj,
    weight: Number((obj.weight / sum).toFixed(4)),
  }))
  return result
}
