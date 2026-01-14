/**
 * User Preferences Module for MetaAligner Objective Personalization
 * 
 * Manages user preferences that influence objective selection and weighting.
 * Supports storage, retrieval, validation, and application of preferences.
 * 
 * Features:
 * - Preference storage with validation
 * - Default preferences with sensible fallbacks
 * - Preference-based objective adjustment
 * - Support style customization
 * - Risk sensitivity configuration
 * - Custom objective weights
 * - Persistence support (localStorage, database, etc.)
 */

import { ObjectivePriority } from './context-objective-mapping'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('user-preferences')

/**
 * User preference types
 */
export type SupportStyle = 'pragmatic' | 'empathic' | 'direct' | 'reflective'
export type ResponseFormality = 'formal' | 'informal' | 'adaptive'
export type RiskSensitivity = 'low' | 'medium' | 'high'
export type VerbosityLevel = 'concise' | 'moderate' | 'detailed'

/**
 * User preferences interface
 */
export interface UserPreferences {
  /** Preferred support interaction style */
  preferredSupportStyle?: SupportStyle

  /** Response formality level */
  responseFormality?: ResponseFormality

  /** Risk sensitivity for safety-critical situations */
  riskSensitivity?: RiskSensitivity

  /** Preferred verbosity level */
  verbosityLevel?: VerbosityLevel

  /** Custom objective weight overrides (0-1 range) */
  customObjectiveWeights?: Partial<Record<string, number>>

  /** Objectives to disable/exclude */
  disableObjectives?: string[]

  /** Objectives to boost/prioritize */
  prioritizeObjectives?: string[]

  /** User demographic/context for personalization */
  userContext?: {
    ageGroup?: 'teen' | 'young_adult' | 'adult' | 'senior'
    culturalBackground?: string
    languagePreference?: string
    accessibilityNeeds?: string[]
  }

  /** Interaction preferences */
  interactionPreferences?: {
    preferQuestions?: boolean
    preferExamples?: boolean
    preferStepByStep?: boolean
    preferSummaries?: boolean
  }

  /** Additional custom preferences */
  [key: string]: unknown
}

/**
 * Default user preferences
 */
export const DEFAULT_PREFERENCES: Required<Pick<UserPreferences,
  'preferredSupportStyle' | 'responseFormality' | 'riskSensitivity' | 'verbosityLevel'>> = {
  preferredSupportStyle: 'empathic',
  responseFormality: 'adaptive',
  riskSensitivity: 'high',
  verbosityLevel: 'moderate',
}

/**
 * Preference validation result
 */
export interface PreferenceValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * User Preference Manager
 * 
 * Manages user preferences with validation, storage, and application logic.
 */
export class UserPreferenceManager {
  private preferences: Map<string, UserPreferences> = new Map()
  private defaultPreferences: UserPreferences

  constructor(defaultPreferences: UserPreferences = DEFAULT_PREFERENCES) {
    this.defaultPreferences = defaultPreferences
  }

  /**
   * Set preferences for a user
   */
  setPreferences(userId: string, preferences: UserPreferences): PreferenceValidationResult {
    const validation = this.validatePreferences(preferences)

    if (!validation.valid) {
      logger.warn('Invalid preferences provided', { userId, errors: validation.errors })
      return validation
    }

    // Merge with defaults
    const mergedPreferences = this.mergeWithDefaults(preferences)
    this.preferences.set(userId, mergedPreferences)

    logger.info('User preferences updated', { userId })
    return validation
  }

  /**
   * Get preferences for a user
   */
  getPreferences(userId: string): UserPreferences {
    return this.preferences.get(userId) || this.defaultPreferences
  }

  /**
   * Update specific preference fields
   */
  updatePreferences(
    userId: string,
    updates: Partial<UserPreferences>,
  ): PreferenceValidationResult {
    const current = this.getPreferences(userId)
    const merged = { ...current, ...updates }
    return this.setPreferences(userId, merged)
  }

  /**
   * Clear preferences for a user
   */
  clearPreferences(userId: string): void {
    this.preferences.delete(userId)
    logger.info('User preferences cleared', { userId })
  }

  /**
   * Validate user preferences
   */
  validatePreferences(preferences: UserPreferences): PreferenceValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Validate support style
    if (preferences.preferredSupportStyle) {
      const validStyles: SupportStyle[] = ['pragmatic', 'empathic', 'direct', 'reflective']
      if (!validStyles.includes(preferences.preferredSupportStyle)) {
        errors.push(`Invalid support style: ${preferences.preferredSupportStyle}`)
      }
    }

    // Validate formality
    if (preferences.responseFormality) {
      const validFormality: ResponseFormality[] = ['formal', 'informal', 'adaptive']
      if (!validFormality.includes(preferences.responseFormality)) {
        errors.push(`Invalid response formality: ${preferences.responseFormality}`)
      }
    }

    // Validate risk sensitivity
    if (preferences.riskSensitivity) {
      const validRisk: RiskSensitivity[] = ['low', 'medium', 'high']
      if (!validRisk.includes(preferences.riskSensitivity)) {
        errors.push(`Invalid risk sensitivity: ${preferences.riskSensitivity}`)
      }
    }

    // Validate custom weights
    if (preferences.customObjectiveWeights) {
      Object.entries(preferences.customObjectiveWeights).forEach(([key, weight]) => {
        if (typeof weight !== 'number' || weight < 0 || weight > 1) {
          errors.push(`Invalid weight for ${key}: ${weight} (must be 0-1)`)
        }
      })
    }

    // Validate disable/prioritize objectives
    if (preferences.disableObjectives && preferences.prioritizeObjectives) {
      const overlap = preferences.disableObjectives.filter(obj =>
        preferences.prioritizeObjectives?.includes(obj)
      )
      if (overlap.length > 0) {
        warnings.push(`Objectives in both disable and prioritize lists: ${overlap.join(', ')}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Merge preferences with defaults
   */
  private mergeWithDefaults(preferences: UserPreferences): UserPreferences {
    return {
      ...this.defaultPreferences,
      ...preferences,
    }
  }

  /**
   * Export preferences for persistence
   */
  exportPreferences(userId: string): string {
    const prefs = this.getPreferences(userId)
    return JSON.stringify(prefs)
  }

  /**
   * Import preferences from persisted data
   */
  importPreferences(userId: string, data: string): PreferenceValidationResult {
    try {
      const preferences = JSON.parse(data) as UserPreferences
      return this.setPreferences(userId, preferences)
    } catch (error) {
      logger.error('Failed to import preferences', { userId, error })
      return {
        valid: false,
        errors: ['Invalid JSON data'],
        warnings: [],
      }
    }
  }

  /**
   * Get all users with preferences
   */
  getAllUsers(): string[] {
    return Array.from(this.preferences.keys())
  }

  /**
   * Clear all preferences
   */
  clearAll(): void {
    this.preferences.clear()
    logger.info('All user preferences cleared')
  }
}

/**
 * Apply user preferences to objective priorities
 * 
 * Adjusts objective weights based on user preferences including:
 * - Support style preferences
 * - Custom weight overrides
 * - Disabled objectives
 * - Prioritized objectives
 * - Risk sensitivity
 */
export function applyUserPreferences(
  objectives: ObjectivePriority[],
  prefs: UserPreferences,
): ObjectivePriority[] {
  let result = [...objectives]

  // Step 1: Filter out disabled objectives
  if (prefs.disableObjectives && prefs.disableObjectives.length > 0) {
    result = result.filter((obj) => !prefs.disableObjectives!.includes(obj.key))
  }

  // Step 2: Apply custom weight overrides
  if (prefs.customObjectiveWeights) {
    result = result.map((obj) =>
      prefs.customObjectiveWeights![obj.key] !== undefined
        ? { ...obj, weight: prefs.customObjectiveWeights![obj.key]! }
        : obj,
    )
  }

  // Step 3: Apply support style adjustments
  if (prefs.preferredSupportStyle) {
    result = applySupportStyleAdjustments(result, prefs.preferredSupportStyle)
  }

  // Step 4: Apply risk sensitivity adjustments
  if (prefs.riskSensitivity) {
    result = applyRiskSensitivityAdjustments(result, prefs.riskSensitivity)
  }

  // Step 5: Apply verbosity adjustments
  if (prefs.verbosityLevel) {
    result = applyVerbosityAdjustments(result, prefs.verbosityLevel)
  }

  // Step 6: Boost prioritized objectives
  if (prefs.prioritizeObjectives && prefs.prioritizeObjectives.length > 0) {
    result = result.map((obj) =>
      prefs.prioritizeObjectives!.includes(obj.key)
        ? { ...obj, weight: Math.min(obj.weight * 1.2, 1) }
        : obj,
    )
  }

  // Step 7: Apply interaction preference adjustments
  if (prefs.interactionPreferences) {
    result = applyInteractionPreferenceAdjustments(result, prefs.interactionPreferences)
  }

  // Step 8: Normalize weights to ensure they sum to 1
  result = normalizeWeights(result)

  return result
}

/**
 * Apply support style specific adjustments
 */
function applySupportStyleAdjustments(
  objectives: ObjectivePriority[],
  style: SupportStyle,
): ObjectivePriority[] {
  const adjustments: Record<SupportStyle, Record<string, number>> = {
    empathic: {
      empathy: 1.25,
      warmth: 1.2,
      safety: 1.15,
    },
    pragmatic: {
      correctness: 1.2,
      informativeness: 1.15,
      conciseness: 1.1,
    },
    direct: {
      conciseness: 1.25,
      clarity: 1.2,
      correctness: 1.15,
    },
    reflective: {
      empathy: 1.15,
      informativeness: 1.1,
      depth: 1.2,
    },
  }

  const styleAdjustments = adjustments[style] || {}

  return objectives.map((obj) => {
    const multiplier = styleAdjustments[obj.key] || 1.0
    return {
      ...obj,
      weight: Math.min(obj.weight * multiplier, 1),
    }
  })
}

/**
 * Apply risk sensitivity adjustments
 */
function applyRiskSensitivityAdjustments(
  objectives: ObjectivePriority[],
  sensitivity: RiskSensitivity,
): ObjectivePriority[] {
  const safetyMultipliers: Record<RiskSensitivity, number> = {
    low: 1.0,
    medium: 1.15,
    high: 1.3,
  }

  const multiplier = safetyMultipliers[sensitivity]

  return objectives.map((obj) =>
    obj.key === 'safety'
      ? { ...obj, weight: Math.min(obj.weight * multiplier, 1) }
      : obj,
  )
}

/**
 * Apply verbosity level adjustments
 */
function applyVerbosityAdjustments(
  objectives: ObjectivePriority[],
  verbosity: VerbosityLevel,
): ObjectivePriority[] {
  const adjustments: Record<VerbosityLevel, Record<string, number>> = {
    concise: {
      conciseness: 1.3,
      clarity: 1.15,
    },
    moderate: {
      // No adjustments - baseline
    },
    detailed: {
      informativeness: 1.2,
      depth: 1.15,
    },
  }

  const verbosityAdjustments = adjustments[verbosity] || {}

  return objectives.map((obj) => {
    const multiplier = verbosityAdjustments[obj.key] || 1.0
    return {
      ...obj,
      weight: Math.min(obj.weight * multiplier, 1),
    }
  })
}

/**
 * Apply interaction preference adjustments
 */
function applyInteractionPreferenceAdjustments(
  objectives: ObjectivePriority[],
  preferences: NonNullable<UserPreferences['interactionPreferences']>,
): ObjectivePriority[] {
  let result = [...objectives]

  // Boost clarity if user prefers step-by-step
  if (preferences.preferStepByStep) {
    result = result.map((obj) =>
      obj.key === 'clarity'
        ? { ...obj, weight: Math.min(obj.weight * 1.15, 1) }
        : obj,
    )
  }

  // Boost informativeness if user prefers examples
  if (preferences.preferExamples) {
    result = result.map((obj) =>
      obj.key === 'informativeness'
        ? { ...obj, weight: Math.min(obj.weight * 1.1, 1) }
        : obj,
    )
  }

  // Boost conciseness if user prefers summaries
  if (preferences.preferSummaries) {
    result = result.map((obj) =>
      obj.key === 'conciseness'
        ? { ...obj, weight: Math.min(obj.weight * 1.15, 1) }
        : obj,
    )
  }

  return result
}

/**
 * Normalize objective weights to sum to 1
 */
function normalizeWeights(objectives: ObjectivePriority[]): ObjectivePriority[] {
  const sum = objectives.reduce((acc, obj) => acc + obj.weight, 0)

  if (sum === 0) {
    // Avoid division by zero - distribute equally
    const equalWeight = 1 / objectives.length
    return objectives.map((obj) => ({ ...obj, weight: equalWeight }))
  }

  return objectives.map((obj) => ({
    ...obj,
    weight: obj.weight / sum,
  }))
}

/**
 * Create a default preference manager instance
 */
export const defaultPreferenceManager = new UserPreferenceManager()
