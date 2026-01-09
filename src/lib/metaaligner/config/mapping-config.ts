/**
 * Context-to-Objective Mapping Configuration System
 * Provides deterministic, config-driven mapping with validation and safety floors
 */

import { ContextType } from '../core/objectives'

/**
 * Objective identifiers matching the core objective system
 */
export enum ObjectiveId {
  CORRECTNESS = 'correctness',
  INFORMATIVENESS = 'informativeness',
  PROFESSIONALISM = 'professionalism',
  EMPATHY = 'empathy',
  SAFETY = 'safety',
  BIAS_DETECTION = 'bias_detection',
  CULTURAL_SENSITIVITY = 'cultural_sensitivity',
}

/**
 * Objective weight configuration with validation constraints
 */
export interface ObjectiveWeightConfig {
  [ObjectiveId.CORRECTNESS]: number
  [ObjectiveId.INFORMATIVENESS]: number
  [ObjectiveId.PROFESSIONALISM]: number
  [ObjectiveId.EMPATHY]: number
  [ObjectiveId.SAFETY]: number
  [ObjectiveId.BIAS_DETECTION]?: number
  [ObjectiveId.CULTURAL_SENSITIVITY]?: number
}

/**
 * Context-specific mapping configuration
 */
export interface ContextMappingConfig {
  context: ContextType
  weights: ObjectiveWeightConfig
  precedence: number // Lower = higher precedence (1 = highest)
  description: string
  enforceSafetyFloor: boolean
}

/**
 * Safety floor constraints to ensure minimum safety consideration
 */
export interface SafetyFloorConfig {
  enabled: boolean
  minimumSafetyWeight: number // Minimum weight for safety objective (0-1)
  contexts: ContextType[] // Contexts where safety floor is enforced
}

/**
 * Precedence rules for conflict resolution
 */
export interface PrecedenceRule {
  higherPrecedenceContext: ContextType
  lowerPrecedenceContext: ContextType
  reason: string
}

/**
 * Complete mapping configuration
 */
export interface MappingConfiguration {
  version: string
  mappings: ContextMappingConfig[]
  safetyFloor: SafetyFloorConfig
  precedenceRules: PrecedenceRule[]
  normalization: 'enabled' | 'disabled'
  validationStrict: boolean
}

/**
 * Validation error types
 */
export enum ValidationErrorType {
  INVALID_WEIGHT = 'INVALID_WEIGHT',
  MISSING_CONTEXT = 'MISSING_CONTEXT',
  MISSING_OBJECTIVE = 'MISSING_OBJECTIVE',
  SAFETY_FLOOR_VIOLATION = 'SAFETY_FLOOR_VIOLATION',
  INVALID_PRECEDENCE = 'INVALID_PRECEDENCE',
  NORMALIZATION_ERROR = 'NORMALIZATION_ERROR',
  DUPLICATE_CONTEXT = 'DUPLICATE_CONTEXT',
}

export interface ValidationError {
  type: ValidationErrorType
  message: string
  context?: ContextType
  objectiveId?: ObjectiveId
}

/**
 * Default mapping configuration following acceptance criteria
 */
export const DEFAULT_MAPPING_CONFIG: MappingConfiguration = {
  version: '1.0.0',
  normalization: 'enabled',
  validationStrict: true,

  safetyFloor: {
    enabled: true,
    minimumSafetyWeight: 0.05, // 5% minimum safety consideration
    contexts: [
      ContextType.CRISIS,
      ContextType.CLINICAL_ASSESSMENT,
      ContextType.SUPPORT,
      ContextType.GENERAL,
    ],
  },

  precedenceRules: [
    {
      higherPrecedenceContext: ContextType.CRISIS,
      lowerPrecedenceContext: ContextType.GENERAL,
      reason: 'Crisis contexts always override general contexts for safety',
    },
    {
      higherPrecedenceContext: ContextType.CRISIS,
      lowerPrecedenceContext: ContextType.EDUCATIONAL,
      reason: 'Crisis contexts override educational contexts',
    },
    {
      higherPrecedenceContext: ContextType.CRISIS,
      lowerPrecedenceContext: ContextType.CLINICAL_ASSESSMENT,
      reason: 'Immediate crisis overrides clinical assessment needs',
    },
    {
      higherPrecedenceContext: ContextType.CLINICAL_ASSESSMENT,
      lowerPrecedenceContext: ContextType.GENERAL,
      reason: 'Clinical assessment has higher precedence than general',
    },
    {
      higherPrecedenceContext: ContextType.SUPPORT,
      lowerPrecedenceContext: ContextType.INFORMATIONAL,
      reason: 'Emotional support needs override informational queries',
    },
  ],

  mappings: [
    {
      context: ContextType.CRISIS,
      precedence: 1, // Highest precedence
      description: 'Immediate safety concerns, self-harm, suicidal ideation',
      enforceSafetyFloor: true,
      weights: {
        [ObjectiveId.SAFETY]: 0.6,
        [ObjectiveId.EMPATHY]: 0.2,
        [ObjectiveId.PROFESSIONALISM]: 0.15,
        [ObjectiveId.CORRECTNESS]: 0.1,
        [ObjectiveId.INFORMATIVENESS]: 0.05,
      },
    },
    {
      context: ContextType.CLINICAL_ASSESSMENT,
      precedence: 2,
      description: 'Clinical evaluation, diagnosis, professional assessment',
      enforceSafetyFloor: true,
      weights: {
        [ObjectiveId.CORRECTNESS]: 0.35,
        [ObjectiveId.SAFETY]: 0.3,
        [ObjectiveId.PROFESSIONALISM]: 0.25,
        [ObjectiveId.EMPATHY]: 0.08,
        [ObjectiveId.INFORMATIVENESS]: 0.02,
      },
    },
    {
      context: ContextType.SUPPORT,
      precedence: 3,
      description: 'Emotional support, validation, coping strategies',
      enforceSafetyFloor: true,
      weights: {
        [ObjectiveId.EMPATHY]: 0.35,
        [ObjectiveId.SAFETY]: 0.25,
        [ObjectiveId.PROFESSIONALISM]: 0.2,
        [ObjectiveId.CORRECTNESS]: 0.15,
        [ObjectiveId.INFORMATIVENESS]: 0.05,
      },
    },
    {
      context: ContextType.EDUCATIONAL,
      precedence: 4,
      description: 'Learning about mental health concepts and treatments',
      enforceSafetyFloor: false,
      weights: {
        [ObjectiveId.CORRECTNESS]: 0.35,
        [ObjectiveId.INFORMATIVENESS]: 0.35,
        [ObjectiveId.PROFESSIONALISM]: 0.15,
        [ObjectiveId.EMPATHY]: 0.1,
        [ObjectiveId.SAFETY]: 0.05,
      },
    },
    {
      context: ContextType.INFORMATIONAL,
      precedence: 5,
      description: 'Factual information about resources and services',
      enforceSafetyFloor: false,
      weights: {
        [ObjectiveId.CORRECTNESS]: 0.3,
        [ObjectiveId.INFORMATIVENESS]: 0.3,
        [ObjectiveId.PROFESSIONALISM]: 0.2,
        [ObjectiveId.EMPATHY]: 0.15,
        [ObjectiveId.SAFETY]: 0.05,
      },
    },
    {
      context: ContextType.GENERAL,
      precedence: 6,
      description: 'General conversation with balanced objectives',
      enforceSafetyFloor: true,
      weights: {
        [ObjectiveId.EMPATHY]: 0.2,
        [ObjectiveId.SAFETY]: 0.2,
        [ObjectiveId.CORRECTNESS]: 0.2,
        [ObjectiveId.PROFESSIONALISM]: 0.2,
        [ObjectiveId.INFORMATIVENESS]: 0.2,
      },
    },
  ],
}

/**
 * Validate that all required ContextTypes are present in the configuration
 */
export function validateContextCoverage(
  config: MappingConfiguration,
): ValidationError[] {
  const errors: ValidationError[] = []
  const configuredContexts = new Set(
    config.mappings.map((m) => m.context),
  )

  // Check that all ContextType enum values are covered
  const allContexts = Object.values(ContextType)
  for (const contextType of allContexts) {
    if (!configuredContexts.has(contextType)) {
      errors.push({
        type: ValidationErrorType.MISSING_CONTEXT,
        message: `Context type ${contextType} is missing from configuration`,
        context: contextType,
      })
    }
  }

  // Check for duplicate contexts
  const contextCounts = new Map<ContextType, number>()
  for (const mapping of config.mappings) {
    const count = contextCounts.get(mapping.context) || 0
    contextCounts.set(mapping.context, count + 1)
  }

  for (const [context, count] of contextCounts.entries()) {
    if (count > 1) {
      errors.push({
        type: ValidationErrorType.DUPLICATE_CONTEXT,
        message: `Context type ${context} appears ${count} times in configuration`,
        context,
      })
    }
  }

  return errors
}

/**
 * Validate objective weights are within valid range [0, 1]
 */
export function validateWeights(
  weights: ObjectiveWeightConfig,
  context: ContextType,
): ValidationError[] {
  const errors: ValidationError[] = []
  const requiredObjectives = [
    ObjectiveId.CORRECTNESS,
    ObjectiveId.INFORMATIVENESS,
    ObjectiveId.PROFESSIONALISM,
    ObjectiveId.EMPATHY,
    ObjectiveId.SAFETY,
  ]

  for (const objectiveId of requiredObjectives) {
    const weight = weights[objectiveId]

    if (weight === undefined) {
      errors.push({
        type: ValidationErrorType.MISSING_OBJECTIVE,
        message: `Required objective ${objectiveId} is missing for context ${context}`,
        context,
        objectiveId,
      })
      continue
    }

    if (typeof weight !== 'number' || weight < 0 || weight > 1) {
      errors.push({
        type: ValidationErrorType.INVALID_WEIGHT,
        message: `Weight for ${objectiveId} must be between 0 and 1, got ${weight}`,
        context,
        objectiveId,
      })
    }
  }

  return errors
}

/**
 * Validate safety floor requirements
 */
export function validateSafetyFloor(
  config: MappingConfiguration,
): ValidationError[] {
  const errors: ValidationError[] = []

  if (!config.safetyFloor.enabled) {
    return errors
  }

  const minSafety = config.safetyFloor.minimumSafetyWeight

  for (const mapping of config.mappings) {
    if (
      mapping.enforceSafetyFloor &&
      config.safetyFloor.contexts.includes(mapping.context)
    ) {
      const safetyWeight = mapping.weights[ObjectiveId.SAFETY]

      if (safetyWeight < minSafety) {
        errors.push({
          type: ValidationErrorType.SAFETY_FLOOR_VIOLATION,
          message: `Safety weight ${safetyWeight} for context ${mapping.context} is below minimum ${minSafety}`,
          context: mapping.context,
          objectiveId: ObjectiveId.SAFETY,
        })
      }
    }
  }

  return errors
}

/**
 * Validate complete configuration
 */
export function validateMappingConfiguration(
  config: MappingConfiguration,
): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = []

  // Validate context coverage
  errors.push(...validateContextCoverage(config))

  // Validate weights for each mapping
  for (const mapping of config.mappings) {
    errors.push(...validateWeights(mapping.weights, mapping.context))
  }

  // Validate safety floor
  errors.push(...validateSafetyFloor(config))

  // Validate normalization if enabled
  if (config.normalization === 'enabled') {
    for (const mapping of config.mappings) {
      const sum = Object.values(mapping.weights).reduce(
        (acc, w) => acc + (w || 0),
        0,
      )
      // Allow small floating point errors
      if (Math.abs(sum - 1.0) > 0.001) {
        errors.push({
          type: ValidationErrorType.NORMALIZATION_ERROR,
          message: `Weights for context ${mapping.context} sum to ${sum}, expected 1.0`,
          context: mapping.context,
        })
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
