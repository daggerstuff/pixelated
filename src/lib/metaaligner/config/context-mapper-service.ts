/**
 * Context-to-Objective Mapper Service
 * Implements deterministic, config-driven mapping with precedence resolution and explainability
 */

import { ContextType } from '../core/objectives'
import {
  MappingConfiguration,
  ObjectiveWeightConfig,
  ObjectiveId,
  DEFAULT_MAPPING_CONFIG,
  validateMappingConfiguration,
  ValidationError,
} from './mapping-config'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('context-mapper-service')

/**
 * Mapping resolution result with explainability
 */
export interface MappingResolutionResult {
  context: ContextType
  weights: ObjectiveWeightConfig
  precedence: number
  reasoning: string[]
  safetyFloorApplied: boolean
  normalized: boolean
}

/**
 * Conflict resolution when multiple contexts detected
 */
export interface ContextConflict {
  contexts: ContextType[]
  resolvedContext: ContextType
  reason: string
}

/**
 * Context-to-Objective Mapper Service
 */
export class ContextMapperService {
  private config: MappingConfiguration
  private mappingCache: Map<ContextType, MappingResolutionResult>

  constructor(config?: MappingConfiguration) {
    this.config = config || DEFAULT_MAPPING_CONFIG
    this.mappingCache = new Map()

    // Validate configuration on initialization - fail fast
    const validation = validateMappingConfiguration(this.config)
    if (!validation.valid) {
      const errorMessages = validation.errors
        .map((e) => `${e.type}: ${e.message}`)
        .join('\n')
      throw new Error(
        `Invalid mapping configuration:\n${errorMessages}`,
      )
    }

    logger.info('Context mapper service initialized', {
      version: this.config.version,
      contexts: this.config.mappings.length,
      safetyFloorEnabled: this.config.safetyFloor.enabled,
    })
  }

  /**
   * Get objective weights for a given context
   */
  getWeightsForContext(context: ContextType): MappingResolutionResult {
    // Check cache first
    if (this.mappingCache.has(context)) {
      return this.mappingCache.get(context)!
    }

    const mapping = this.config.mappings.find((m) => m.context === context)

    if (!mapping) {
      logger.warn('Context not found in configuration, using GENERAL', {
        requestedContext: context,
      })
      return this.getWeightsForContext(ContextType.GENERAL)
    }

    let weights = { ...mapping.weights }
    const reasoning: string[] = []
    let safetyFloorApplied = false

    reasoning.push(`Mapped to ${context} context (precedence: ${mapping.precedence})`)
    reasoning.push(mapping.description)

    // Apply safety floor if required
    if (mapping.enforceSafetyFloor && this.config.safetyFloor.enabled) {
      const currentSafety = weights[ObjectiveId.SAFETY]
      const minSafety = this.config.safetyFloor.minimumSafetyWeight

      if (currentSafety < minSafety) {
        weights[ObjectiveId.SAFETY] = minSafety
        safetyFloorApplied = true
        reasoning.push(
          `Safety floor applied: raised from ${currentSafety} to ${minSafety}`,
        )
      }
    }

    // Normalize weights if required
    let normalized = false
    if (this.config.normalization === 'enabled') {
      weights = this.normalizeWeights(weights)
      normalized = true
      reasoning.push('Weights normalized to sum to 1.0')
    }

    const result: MappingResolutionResult = {
      context,
      weights,
      precedence: mapping.precedence,
      reasoning,
      safetyFloorApplied,
      normalized,
    }

    // Cache the result
    this.mappingCache.set(context, result)

    // Log mapping decision with explainability (no PII)
    logger.info('Context mapping resolved', {
      context,
      precedence: mapping.precedence,
      safetyFloorApplied,
      normalized,
      topObjective: this.getTopObjective(weights),
    })

    return result
  }

  /**
   * Resolve conflicts when multiple contexts are detected
   * Uses precedence rules from configuration
   */
  resolveContextConflict(contexts: ContextType[]): ContextConflict {
    if (contexts.length === 0) {
      return {
        contexts: [ContextType.GENERAL],
        resolvedContext: ContextType.GENERAL,
        reason: 'No contexts provided, defaulting to GENERAL',
      }
    }

    if (contexts.length === 1) {
      return {
        contexts,
        resolvedContext: contexts[0],
        reason: 'Single context, no conflict',
      }
    }

    // Get mappings for all contexts
    const mappings = contexts
      .map((ctx) => this.config.mappings.find((m) => m.context === ctx))
      .filter((m) => m !== undefined)

    if (mappings.length === 0) {
      return {
        contexts,
        resolvedContext: ContextType.GENERAL,
        reason: 'No valid mappings found, defaulting to GENERAL',
      }
    }

    // Sort by precedence (lower number = higher precedence)
    mappings.sort((a, b) => a!.precedence - b!.precedence)
    const winner = mappings[0]!

    // Find applicable precedence rule
    let reason = `Resolved by precedence: ${winner.context} has precedence ${winner.precedence}`

    for (const rule of this.config.precedenceRules) {
      if (
        contexts.includes(rule.higherPrecedenceContext) &&
        contexts.includes(rule.lowerPrecedenceContext) &&
        winner.context === rule.higherPrecedenceContext
      ) {
        reason = `${rule.reason} (${rule.higherPrecedenceContext} > ${rule.lowerPrecedenceContext})`
        break
      }
    }

    logger.info('Context conflict resolved', {
      conflictingContexts: contexts,
      resolvedContext: winner.context,
      precedence: winner.precedence,
    })

    return {
      contexts,
      resolvedContext: winner.context,
      reason,
    }
  }

  /**
   * Get mapping with explainability for a context
   * Includes reasoning for the mapping decision
   */
  getMappingWithExplainability(
    context: ContextType,
  ): MappingResolutionResult {
    return this.getWeightsForContext(context)
  }

  /**
   * Validate a custom configuration without applying it
   */
  static validateConfiguration(
    config: MappingConfiguration,
  ): { valid: boolean; errors: ValidationError[] } {
    return validateMappingConfiguration(config)
  }

  /**
   * Update configuration (useful for runtime config updates)
   * Fails fast if invalid
   */
  updateConfiguration(config: MappingConfiguration): void {
    const validation = validateMappingConfiguration(config)
    if (!validation.valid) {
      const errorMessages = validation.errors
        .map((e) => `${e.type}: ${e.message}`)
        .join('\n')
      throw new Error(
        `Cannot update configuration - validation failed:\n${errorMessages}`,
      )
    }

    this.config = config
    this.mappingCache.clear()

    logger.info('Configuration updated', {
      version: config.version,
      contexts: config.mappings.length,
    })
  }

  /**
   * Get the current configuration
   */
  getConfiguration(): MappingConfiguration {
    return { ...this.config }
  }

  /**
   * Normalize weights to sum to 1.0
   */
  private normalizeWeights(
    weights: ObjectiveWeightConfig,
  ): ObjectiveWeightConfig {
    const sum = Object.values(weights).reduce((acc, w) => acc + (w || 0), 0)

    if (sum === 0) {
      // Equal weights if all are zero
      const equalWeight = 1.0 / Object.keys(weights).length
      const normalized: any = {}
      for (const key of Object.keys(weights)) {
        normalized[key] = equalWeight
      }
      return normalized
    }

    const normalized: any = {}
    for (const [key, value] of Object.entries(weights)) {
      normalized[key] = value / sum
    }

    return normalized
  }

  /**
   * Get the objective with highest weight
   */
  private getTopObjective(weights: ObjectiveWeightConfig): ObjectiveId {
    let maxWeight = -1
    let topObjective = ObjectiveId.CORRECTNESS

    for (const [key, value] of Object.entries(weights)) {
      if (value > maxWeight) {
        maxWeight = value
        topObjective = key as ObjectiveId
      }
    }

    return topObjective
  }

  /**
   * Clear the mapping cache (useful for testing)
   */
  clearCache(): void {
    this.mappingCache.clear()
  }
}

/**
 * Singleton instance for application-wide use
 */
let defaultMapperService: ContextMapperService | null = null

/**
 * Get or create the default mapper service
 */
export function getContextMapperService(): ContextMapperService {
  if (!defaultMapperService) {
    defaultMapperService = new ContextMapperService()
  }
  return defaultMapperService
}

/**
 * Reset the default mapper service (useful for testing)
 */
export function resetContextMapperService(): void {
  defaultMapperService = null
}
