/**
 * Dynamic Weighting System with Smoothing and Hysteresis
 * Implements weighted blending, crisis overrides, and stability guards
 * 
 * PIX-22: Dynamic weighting based on context
 */

import { ContextType, AlignmentContext } from './objectives'
import { getContextMapperService } from '../config/context-mapper-service'
import { ObjectiveId } from '../config/mapping-config'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

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
  weights: Record<string, number>
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
  weights: Record<string, number>
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
  private oscillationTrackers: Map<string, OscillationTracker> = new Map()
  private cache: {
    weights: Record<string, number> | null
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
  calculateDynamicWeights(
    context: AlignmentContext,
  ): WeightUpdateResult {
    const startTime = performance.now()
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
      context.confidence >= this.config.crisisOverrideThreshold
    ) {
      // Crisis override bypasses smoothing and applies immediately
      reasoning.push(
        `Crisis override applied (confidence: ${context.confidence.toFixed(2)})`,
      )
      crisisOverrideApplied = true
      
      // Update cache and history
      this.updateCache(context.detectedContext, newWeights)
      this.addToHistory(context, newWeights)
      
      const updateTime = performance.now() - startTime
      
      logger.info('Crisis override applied', {
        updateTimeMs: updateTime,
        confidence: context.confidence,
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
      reasoning.push(
        `Blending applied (alpha: ${this.config.blendingAlpha})`,
      )
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
    newWeights: Record<string, number>,
    previousWeights: Record<string, number>,
    alpha?: number,
  ): Record<string, number> {
    const blendAlpha = alpha ?? this.config.blendingAlpha
    const blended: Record<string, number> = {}

    for (const [key, newValue] of Object.entries(newWeights)) {
      const prevValue = previousWeights[key] ?? newValue
      // EMA: blended = alpha * previous + (1 - alpha) * new
      blended[key] = blendAlpha * prevValue + (1 - blendAlpha) * newValue
    }

    return blended
  }

  /**
   * Apply stability guard to limit maximum weight change per turn
   */
  private applyStabilityGuard(
    newWeights: Record<string, number>,
    previousWeights: Record<string, number>,
  ): Record<string, number> {
    const guarded: Record<string, number> = {}
    const maxChange = this.config.maxWeightChangePerTurn

    for (const [key, newValue] of Object.entries(newWeights)) {
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

    return guarded
  }

  /**
   * Check if weight change is significant enough to update (hysteresis)
   */
  private isChangeSignificant(
    newWeights: Record<string, number>,
    previousWeights: Record<string, number>,
  ): boolean {
    const threshold = this.config.hysteresisThreshold

    for (const [key, newValue] of Object.entries(newWeights)) {
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
    newWeights: Record<string, number>,
    previousWeights: Record<string, number>,
  ): boolean {
    const window = this.config.oscillationDetectionWindow
    const threshold = this.config.oscillationThreshold

    // Only check if we have enough history
    if (this.weightHistory.length < window) {
      return false
    }

    // Track direction changes for each objective
    for (const [objectiveId, newValue] of Object.entries(newWeights)) {
      const prevValue = previousWeights[objectiveId] ?? newValue
      const change = newValue - prevValue

      let direction: 'up' | 'down' | 'stable' = 'stable'
      if (change > 0.01) direction = 'up'
      else if (change < -0.01) direction = 'down'

      // Get or create tracker
      let tracker = this.oscillationTrackers.get(objectiveId)
      if (!tracker) {
        tracker = {
          objectiveId,
          directionChanges: 0,
          lastDirection: direction,
        }
        this.oscillationTrackers.set(objectiveId, tracker)
      }

      // Check for direction change
      if (direction !== 'stable' && direction !== tracker.lastDirection) {
        tracker.directionChanges++
        tracker.lastDirection = direction
      }

      // Check if oscillation threshold exceeded
      if (tracker.directionChanges >= threshold) {
        return true
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
    weights: Record<string, number>,
  ): Record<string, number> {
    const sum = Object.values(weights).reduce((acc, w) => acc + w, 0)

    if (sum === 0 || sum === 1.0) {
      return weights
    }

    const normalized: Record<string, number> = {}
    for (const [key, value] of Object.entries(weights)) {
      normalized[key] = value / sum
    }

    return normalized
  }

  /**
   * Get previous weights from history
   */
  private getPreviousWeights(): Record<string, number> | null {
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
    weights: Record<string, number>,
  ): void {
    this.weightHistory.push({
      timestamp: Date.now(),
      context: context.detectedContext,
      weights: { ...weights },
      confidence: context.confidence,
    })

    // Keep only recent history
    const maxHistory = Math.max(
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
    weights: Record<string, number>,
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
   * Check if two weight objects are equal (within tolerance)
   */
  private weightsEqual(
    weights1: Record<string, number>,
    weights2: Record<string, number>,
    tolerance: number = 0.0001,
  ): boolean {
    const keys1 = Object.keys(weights1)
    const keys2 = Object.keys(weights2)

    if (keys1.length !== keys2.length) {
      return false
    }

    for (const key of keys1) {
      const diff = Math.abs(weights1[key] - weights2[key])
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
  if (!defaultDynamicWeightingEngine) {
    defaultDynamicWeightingEngine = new DynamicWeightingEngine()
  }
  return defaultDynamicWeightingEngine
}

/**
 * Reset the default engine (useful for testing)
 */
export function resetDynamicWeightingEngine(): void {
  defaultDynamicWeightingEngine = null
}
