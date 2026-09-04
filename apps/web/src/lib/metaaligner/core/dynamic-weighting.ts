/**
 * Dynamic Weighting System with Smoothing and Hysteresis
 * Implements weighted blending, crisis overrides, and stability guards
 *
 * PIX-22: Dynamic weighting based on context
 */

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { getContextMapperService } from '../config/context-mapper-service'
import { ContextualObjectiveWeights } from '../prioritization/context-objective-mapper'
import { ContextType, AlignmentContext } from './objectives'

const logger = createBuildSafeLogger('dynamic-weighting')

/**
 * Configuration for dynamic weighting behavior
 */
export interface DynamicWeightingConfig {
  // Blending parameters
  blendingEnabled: boolean
  blendingAlpha: number // 0-1, how much new weights blend with previous (0 = no smoothing, 1 = full smoothing)

  // Crisis override
  crisisOverrideEnabled: boolean
  crisisOverrideThreshold: number // Confidence threshold for crisis override (0-1)

  // Hysteresis parameters
  hysteresisEnabled: boolean
  hysteresisThreshold: number // Minimum weight change to trigger update (0-1)
  hysteresisWindow: number // Number of turns to consider for stability

  // Stability guards
  stabilityGuardEnabled: boolean
  maxWeightChangePerTurn: number // Maximum weight change per turn (0-1)
  oscillationDetectionWindow: number // Number of turns to check for oscillation
  oscillationThreshold: number // Number of direction changes to consider oscillation

  // Performance
  enableCaching: boolean
  cacheTTLMs: number // Cache time-to-live in milliseconds

  // Normalization
  normalizeWeights: boolean
}

/**
 * Weight update result with telemetry
 */
export interface WeightUpdateResult {
  weights: ContextualObjectiveWeights
  context: ContextType
  updateTimeMs: number
  blendingApplied: boolean
  crisisOverrideApplied: boolean
  hysteresisApplied: boolean
  stabilityGuardApplied: boolean
  oscillationDetected: boolean
  reasoning: string[]
}

/**
 * Weight history entry for smoothing and oscillation detection
 */
interface WeightHistoryEntry {
  timestamp: number
  context: ContextType
  weights: ContextualObjectiveWeights
  confidence: number
}

/**
 * Oscillation tracking data
 */
interface OscillationTracker {
  objectiveId: string
  directionChanges: number
  lastDirection: 'up' | 'down' | 'stable'
}

/**
 * Default configuration for dynamic weighting
 */
export const DEFAULT_DYNAMIC_WEIGHTING_CONFIG: DynamicWeightingConfig = {
  blendingEnabled: true,
  blendingAlpha: 0.3, // 30% smoothing - responsive but stable

  crisisOverrideEnabled: true,
  crisisOverrideThreshold: 0.8,

  hysteresisEnabled: true,
  hysteresisThreshold: 0.05, // 5% minimum change
  hysteresisWindow: 3,

  stabilityGuardEnabled: true,
  maxWeightChangePerTurn: 0.2, // Max 20% change per turn
  oscillationDetectionWindow: 5,
  oscillationThreshold: 3, // 3+ direction changes = oscillation

  enableCaching: true,
  cacheTTLMs: 100, // 100ms cache

  normalizeWeights: true,
}

/**
 * Dynamic Weighting Engine with smoothing and stability
 */
export class DynamicWeightingEngine {
  private config: DynamicWeightingConfig
  private weightHistory: WeightHistoryEntry[] = []
  private readonly oscillationTrackers: Map<string, OscillationTracker> =
    new Map()
  private cache: {
    weights: ContextualObjectiveWeights | null
    context: ContextType | null
    timestamp: number
  } = {
    weights: null,
    context: null,
    timestamp: 0,
  }

  constructor(config?: Partial<DynamicWeightingConfig>) {
    this.config = { ...DEFAULT_DYNAMIC_WEIGHTING_CONFIG, ...config }
  }

  /**
   * Calculate dynamic weights for a given context with smoothing and stability
   */
  calculateDynamicWeights(context: AlignmentContext): WeightUpdateResult {
    const startTime = performance.now()
    const contextConfidence = this.getContextConfidence(context)
    const reasoning: string[] = []

    // Check cache first
    if (this.config.enableCaching && this.isCacheValid(context)) {
      const cachedWeights = this.cache.weights!
      const updateTime = performance.now() - startTime

      reasoning.push(`Cached weights used (${updateTime.toFixed(2)}ms)`)

      return {
        weights: cachedWeights,
        context: context.detectedContext,
        updateTimeMs: updateTime,
        blendingApplied: false,
        crisisOverrideApplied: false,
        hysteresisApplied: false,
        stabilityGuardApplied: false,
        oscillationDetected: false,
        reasoning,
      }
    }

    // Get base weights from context mapper
    const mapperService = getContextMapperService()
    const mappingResult = mapperService.getWeightsForContext(
      context.detectedContext,
    )

    let newWeights = { ...mappingResult.weights }
    reasoning.push(...mappingResult.reasoning)

    // Crisis override - always takes precedence
    let crisisOverrideApplied = false
    if (
      this.config.crisisOverrideEnabled &&
      context.detectedContext === ContextType.CRISIS &&
      contextConfidence >= this.config.crisisOverrideThreshold
    ) {
      // Crisis override bypasses smoothing and applies immediately
      reasoning.push(
        `Crisis override applied (confidence: ${contextConfidence.toFixed(2)})`,
      )
      crisisOverrideApplied = true

      // Update cache and history
      this.updateCache(context.detectedContext, newWeights)
      this.addToHistory(context, newWeights)

      const updateTime = performance.now() - startTime

      logger.info('Crisis override applied', {
        updateTimeMs: updateTime,
        confidence: contextConfidence,
      })

      return {
        weights: newWeights,
        context: context.detectedContext,
        updateTimeMs: updateTime,
        blendingApplied: false,
        crisisOverrideApplied: true,
        hysteresisApplied: false,
        stabilityGuardApplied: false,
        oscillationDetected: false,
        reasoning,
      }
    }

    // Get previous weights for smoothing
    const previousWeights = this.getPreviousWeights()

    let blendingApplied = false
    let hysteresisApplied = false
    let stabilityGuardApplied = false
    let oscillationDetected = false

    // Apply blending (smoothing) if enabled and we have history
    if (this.config.blendingEnabled && previousWeights) {
      newWeights = this.applyBlending(newWeights, previousWeights)
      blendingApplied = true
      reasoning.push(`Blending applied (alpha: ${this.config.blendingAlpha})`)
    }

    // Detect oscillation
    if (this.config.stabilityGuardEnabled && previousWeights) {
      oscillationDetected = this.detectOscillation(newWeights, previousWeights)

      if (oscillationDetected) {
        // Increase smoothing to dampen oscillation
        newWeights = this.applyBlending(
          newWeights,
          previousWeights,
          Math.min(0.7, this.config.blendingAlpha * 2),
        )
        reasoning.push('Oscillation detected - increased smoothing')
      }
    }

    // Apply stability guard - limit maximum change per turn
    if (this.config.stabilityGuardEnabled && previousWeights) {
      const guardedWeights = this.applyStabilityGuard(
        newWeights,
        previousWeights,
      )

      if (!this.weightsEqual(guardedWeights, newWeights)) {
        newWeights = guardedWeights
        stabilityGuardApplied = true
        reasoning.push(
          `Stability guard applied (max change: ${this.config.maxWeightChangePerTurn})`,
        )
      }
    }

    // Apply hysteresis - only update if change is significant
    if (this.config.hysteresisEnabled && previousWeights) {
      const changeSignificant = this.isChangeSignificant(
        newWeights,
        previousWeights,
      )

      if (!changeSignificant) {
        newWeights = previousWeights
        hysteresisApplied = true
        reasoning.push(
          `Hysteresis applied - change below threshold (${this.config.hysteresisThreshold})`,
        )
      }
    }

    // Normalize if configured
    if (this.config.normalizeWeights) {
      newWeights = this.normalizeWeights(newWeights)
    }

    // Update cache and history
    this.updateCache(context.detectedContext, newWeights)
    this.addToHistory(context, newWeights)

    const updateTime = performance.now() - startTime

    // Log if update exceeds 250ms threshold
    if (updateTime > 250) {
      logger.warn('Weight update exceeded 250ms threshold', {
        updateTimeMs: updateTime,
        context: context.detectedContext,
      })
    }

    logger.info('Dynamic weights calculated', {
      updateTimeMs: updateTime,
      context: context.detectedContext,
      blendingApplied,
      hysteresisApplied,
      stabilityGuardApplied,
      oscillationDetected,
    })

    return {
      weights: newWeights,
      context: context.detectedContext,
      updateTimeMs: updateTime,
      blendingApplied,
      crisisOverrideApplied,
      hysteresisApplied,
      stabilityGuardApplied,
      oscillationDetected,
      reasoning,
    }
  }

  /**
   * Apply exponential moving average blending between new and previous weights
   */
  private applyBlending(
    newWeights: ContextualObjectiveWeights,
    previousWeights: ContextualObjectiveWeights,
    alpha?: number,
  ): ContextualObjectiveWeights {
    const blendAlpha = alpha ?? this.config.blendingAlpha
    const blended: Partial<ContextualObjectiveWeights> = {}

    for (const [k, v] of Object.entries(newWeights) as [
      keyof ContextualObjectiveWeights,
      number | undefined,
    ][]) {
      const newValue = v ?? 0
      const key = k
      const prevValue = previousWeights[key] ?? newValue
      // EMA: blended = alpha * previous + (1 - alpha) * new
      blended[key] = blendAlpha * prevValue + (1 - blendAlpha) * newValue
    }

    return blended as ContextualObjectiveWeights
  }

  /**
   * Apply stability guard to limit maximum weight change per turn
   */
  private applyStabilityGuard(
    newWeights: ContextualObjectiveWeights,
    previousWeights: ContextualObjectiveWeights,
  ): ContextualObjectiveWeights {
    const guarded: Partial<ContextualObjectiveWeights> = {}
    const maxChange = this.config.maxWeightChangePerTurn

    for (const [k, v] of Object.entries(newWeights) as [
      keyof ContextualObjectiveWeights,
      number | undefined,
    ][]) {
      const newValue = v ?? 0
      const key = k
      const prevValue = previousWeights[key] ?? newValue
      const change = newValue - prevValue
      const absChange = Math.abs(change)

      if (absChange > maxChange) {
        // Limit change to maxChange
        const direction = change > 0 ? 1 : -1
        guarded[key] = prevValue + direction * maxChange
      } else {
        guarded[key] = newValue
      }
    }

    return guarded as ContextualObjectiveWeights
  }

  /**
   * Check if weight change is significant enough to update (hysteresis)
   */
  private isChangeSignificant(
    newWeights: ContextualObjectiveWeights,
    previousWeights: ContextualObjectiveWeights,
  ): boolean {
    const threshold = this.config.hysteresisThreshold

    for (const [k, v] of Object.entries(newWeights) as [
      keyof ContextualObjectiveWeights,
      number | undefined,
    ][]) {
      const newValue = v ?? 0
      const key = k
      const prevValue = previousWeights[key] ?? newValue
      const change = Math.abs(newValue - prevValue)

      if (change > threshold) {
        return true
      }
    }

    return false
  }

  /**
   * Detect oscillation in weight updates
   */
  private detectOscillation(
    newWeights: ContextualObjectiveWeights,
    previousWeights: ContextualObjectiveWeights,
  ): boolean {
    const window = this.config.oscillationDetectionWindow
    const threshold = this.config.oscillationThreshold

    // Only check if we have enough history
    // We remove the early return here because we want to update trackers cumulatively
    // even before the window is full.

    // Track direction changes for each objective
    for (const [k, v] of Object.entries(newWeights) as [
      keyof ContextualObjectiveWeights,
      number | undefined,
    ][]) {
      const newValue = v ?? 0
      const objectiveId = k as string
      const prevValue =
        previousWeights[objectiveId as keyof ContextualObjectiveWeights] ??
        newValue
      const change = newValue - prevValue

      let direction: 'up' | 'down' | 'stable' = 'stable'
      if (change > 0.01) direction = 'up'
      else if (change < -0.01) direction = 'down'

      // Get or create tracker
      const existingTracker = this.oscillationTrackers.get(objectiveId)
      if (existingTracker) {
        // Check for direction change
        if (
          direction !== 'stable' &&
          direction !== existingTracker.lastDirection
        ) {
          existingTracker.directionChanges++
          existingTracker.lastDirection = direction
        }

        // Check if oscillation threshold exceeded
        if (existingTracker.directionChanges >= threshold) {
          return true
        }
      } else {
        this.oscillationTrackers.set(objectiveId, {
          objectiveId,
          directionChanges: 0,
          lastDirection: direction,
        })
      }
    }

    // Reset trackers periodically
    if (this.weightHistory.length % window === 0) {
      this.oscillationTrackers.clear()
    }

    return false
  }

  /**
   * Normalize weights to sum to 1.0
   */
  private normalizeWeights(
    weights: ContextualObjectiveWeights,
  ): ContextualObjectiveWeights {
    const sum = (Object.values(weights) as (number | undefined)[]).reduce(
      (acc: number, w) => acc + (w ?? 0),
      0,
    )

    if (sum === 0 || sum === 1.0) {
      return weights
    }

    const normalized: Partial<ContextualObjectiveWeights> = {}
    for (const [k, v] of Object.entries(weights) as [
      keyof ContextualObjectiveWeights,
      number | undefined,
    ][]) {
      normalized[k] = (v ?? 0) / sum
    }

    return normalized as ContextualObjectiveWeights
  }

  /**
   * Get previous weights from history
   */
  private getPreviousWeights(): ContextualObjectiveWeights | null {
    if (this.weightHistory.length === 0) {
      return null
    }

    return this.weightHistory[this.weightHistory.length - 1].weights
  }

  /**
   * Add entry to weight history
   */
  private addToHistory(
    context: AlignmentContext,
    weights: ContextualObjectiveWeights,
  ): void {
    this.weightHistory.push({
      timestamp: Date.now(),
      context: context.detectedContext,
      weights: { ...weights },
      confidence: this.getContextConfidence(context),
    })

    // Keep only recent history
    const maxHistory =
      Math.max(
        this.config.hysteresisWindow,
        this.config.oscillationDetectionWindow,
      ) * 2

    if (this.weightHistory.length > maxHistory) {
      this.weightHistory = this.weightHistory.slice(-maxHistory)
    }
  }

  /**
   * Update weight cache
   */
  private updateCache(
    context: ContextType,
    weights: ContextualObjectiveWeights,
  ): void {
    this.cache = {
      weights: { ...weights },
      context,
      timestamp: Date.now(),
    }
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(context: AlignmentContext): boolean {
    if (!this.cache.weights || !this.cache.context) {
      return false
    }

    // Cache invalid if context changed
    if (this.cache.context !== context.detectedContext) {
      return false
    }

    // Cache invalid if TTL expired
    const age = Date.now() - this.cache.timestamp
    if (age > this.config.cacheTTLMs) {
      return false
    }

    return true
  }

  /**
   * Resolve context confidence from explicit or metadata-backed fields.
   */
  private getContextConfidence(context: AlignmentContext): number {
    if (typeof context.confidence === 'number') {
      return context.confidence
    }

    return context.sessionMetadata?.confidence ?? 0
  }

  /**
   * Check if two weight objects are equal (within tolerance)
   */
  private weightsEqual(
    weights1: ContextualObjectiveWeights,
    weights2: ContextualObjectiveWeights,
    tolerance: number = 0.0001,
  ): boolean {
    const keys1 = Object.keys(weights1)
    const keys2 = Object.keys(weights2)

    if (keys1.length !== keys2.length) {
      return false
    }

    for (const key of keys1) {
      const diff = Math.abs(weights1?.[key] - weights2?.[key])
      if (diff > tolerance) {
        return false
      }
    }

    return true
  }

  /**
   * Get weight history (for debugging/analysis)
   */
  getWeightHistory(): WeightHistoryEntry[] {
    return [...this.weightHistory]
  }

  /**
   * Clear history and cache (useful for testing)
   */
  reset(): void {
    this.weightHistory = []
    this.oscillationTrackers.clear()
    this.cache = {
      weights: null,
      context: null,
      timestamp: 0,
    }
  }

  /**
   * Get current configuration
   */
  getConfiguration(): DynamicWeightingConfig {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  updateConfiguration(config: Partial<DynamicWeightingConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

/**
 * Singleton instance for application-wide use
 */
let defaultDynamicWeightingEngine: DynamicWeightingEngine | null = null

/**
 * Get or create the default dynamic weighting engine
 */
export function getDynamicWeightingEngine(): DynamicWeightingEngine {
  defaultDynamicWeightingEngine ??= new DynamicWeightingEngine()
  return defaultDynamicWeightingEngine
}

/**
 * Reset the default engine (useful for testing)
 */
export function resetDynamicWeightingEngine(): void {
  defaultDynamicWeightingEngine = null
}
