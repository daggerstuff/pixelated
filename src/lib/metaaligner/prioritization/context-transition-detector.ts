/**
 * Context Transition Detection & Handling System for MetaAligner
 * 
 * Tracks context changes across conversation turns and manages smooth transitions
 * between different context types (crisis, educational, support, clinical, informational).
 * 
 * Features:
 * - History-based transition detection
 * - Crisis elevation with immediate switching
 * - Smoothing for non-critical transitions to avoid oscillation
 * - PII-safe logging and telemetry
 * - Configurable sensitivity and smoothing parameters
 */

import { ContextType } from '../core/objectives'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('context-transition-detector')

/**
 * Represents metadata associated with each context detection event
 */
export interface ContextEvent {
  turnId: string | number
  contextType: ContextType
  confidence: number
  urgency: 'low' | 'medium' | 'high' | 'critical'
  meta?: Record<string, unknown>
  timestamp: number
}

/**
 * Describes a transition between two context detection events
 */
export interface ContextTransition {
  from: ContextEvent
  to: ContextEvent
  detected: boolean
  transitionType: 'crisis_elevation' | 'standard' | 'none'
  shouldSmooth: boolean
  confidence: number
}

/**
 * Handler signature for responding to transitions (extensible)
 */
export type ContextTransitionHandler = (
  transition: ContextTransition,
) => void | Promise<void>

/**
 * Configuration for transition detection behavior
 */
export interface TransitionDetectorConfig {
  /** Minimum confidence threshold for accepting a transition */
  minConfidenceThreshold?: number
  /** Number of consecutive detections required for non-crisis transitions */
  smoothingWindow?: number
  /** Enable immediate crisis elevation without smoothing */
  enableCrisisElevation?: boolean
  /** Enable telemetry logging (PII-safe) */
  enableTelemetry?: boolean
}

/**
 * Context Transition Detector
 * 
 * Manages detection and handling of context transitions across conversation turns.
 * Implements smoothing to prevent oscillation and immediate crisis elevation.
 */
export class ContextTransitionDetector {
  private history: ContextEvent[] = []
  private config: Required<TransitionDetectorConfig>
  private pendingTransitions: Map<ContextType, number> = new Map()

  constructor(config: TransitionDetectorConfig = {}) {
    this.config = {
      minConfidenceThreshold: config.minConfidenceThreshold ?? 0.7,
      smoothingWindow: config.smoothingWindow ?? 2,
      enableCrisisElevation: config.enableCrisisElevation ?? true,
      enableTelemetry: config.enableTelemetry ?? true,
    }
  }

  /**
   * Add a new context event and detect transitions
   */
  addEvent(event: ContextEvent): ContextTransition | null {
    // Ensure timestamp is set
    const enrichedEvent: ContextEvent = {
      ...event,
      timestamp: event.timestamp || Date.now(),
    }

    // Get previous event for comparison
    const previousEvent = this.getCurrentContext()

    // Add to history
    this.history.push(enrichedEvent)

    // Keep history bounded (last 50 events)
    if (this.history.length > 50) {
      this.history.shift()
    }

    // Detect transition if we have a previous context
    if (!previousEvent) {
      return null
    }

    return this.detectTransition(previousEvent, enrichedEvent)
  }

  /**
   * Detect transition between two events with smoothing logic
   */
  private detectTransition(
    prev: ContextEvent,
    curr: ContextEvent,
  ): ContextTransition {
    const contextChanged = prev.contextType !== curr.contextType
    
    // Determine transition type
    let transitionType: ContextTransition['transitionType'] = 'none'
    let shouldSmooth = false
    let {confidence} = curr

    if (contextChanged) {
      // Check for crisis elevation
      if (
        this.config.enableCrisisElevation &&
        curr.contextType === ContextType.CRISIS
      ) {
        transitionType = 'crisis_elevation'
        shouldSmooth = false // Immediate transition for crisis
        confidence = 1.0 // High confidence for crisis elevation
      } else {
        // Standard transition - apply smoothing
        transitionType = 'standard'
        
        // Check if confidence meets threshold
        if (curr.confidence >= this.config.minConfidenceThreshold) {
          // Track pending transition
          const count = (this.pendingTransitions.get(curr.contextType) || 0) + 1
          this.pendingTransitions.set(curr.contextType, count)

          // Require multiple consecutive detections
          if (count >= this.config.smoothingWindow) {
            shouldSmooth = false // Transition confirmed
            this.pendingTransitions.clear()
          } else {
            shouldSmooth = true // Still smoothing
            confidence = count / this.config.smoothingWindow
          }
        } else {
          // Low confidence - continue smoothing
          shouldSmooth = true
          this.pendingTransitions.clear()
        }
      }
    } else {
      // No context change - clear pending transitions
      this.pendingTransitions.clear()
    }

    const transition: ContextTransition = {
      from: prev,
      to: curr,
      detected: contextChanged && !shouldSmooth,
      transitionType,
      shouldSmooth,
      confidence,
    }

    // Log transition (PII-safe)
    if (this.config.enableTelemetry && transition.detected) {
      this.logTransition(transition)
    }

    return transition
  }

  /**
   * Get the current context (most recent event)
   */
  getCurrentContext(): ContextEvent | null {
    return this.history.length > 0 ? this.history[this.history.length - 1]! : null
  }

  /**
   * Get recent context history
   */
  getHistory(count: number = 10): ContextEvent[] {
    return this.history.slice(-count)
  }

  /**
   * Clear history (useful for new conversations)
   */
  clearHistory(): void {
    this.history = []
    this.pendingTransitions.clear()
  }

  /**
   * Get transition statistics for analysis
   */
  getTransitionStats(): {
    totalEvents: number
    transitions: number
    crisisElevations: number
    averageConfidence: number
  } {
    let transitions = 0
    let crisisElevations = 0
    let totalConfidence = 0

    for (let i = 1; i < this.history.length; i++) {
      const prev = this.history[i - 1]!
      const curr = this.history[i]!

      if (prev.contextType !== curr.contextType) {
        transitions++
        if (curr.contextType === ContextType.CRISIS) {
          crisisElevations++
        }
      }
      totalConfidence += curr.confidence
    }

    return {
      totalEvents: this.history.length,
      transitions,
      crisisElevations,
      averageConfidence:
        this.history.length > 0 ? totalConfidence / this.history.length : 0,
    }
  }

  /**
   * PII-safe transition logging
   */
  private logTransition(transition: ContextTransition): void {
    logger.info('Context transition detected', {
      fromContext: transition.from.contextType,
      toContext: transition.to.contextType,
      transitionType: transition.transitionType,
      confidence: transition.confidence,
      urgency: transition.to.urgency,
      turnId: transition.to.turnId,
      timeDelta: transition.to.timestamp - transition.from.timestamp,
    })
  }
}

/**
 * Detect context transition between consecutive events (legacy function)
 * @deprecated Use ContextTransitionDetector class instead
 */
export function detectContextTransition(
  prev: ContextEvent,
  curr: ContextEvent,
): ContextTransition {
  const detected = prev.contextType !== curr.contextType
  const isCrisis = curr.contextType === ContextType.CRISIS

  return {
    from: prev,
    to: curr,
    detected,
    transitionType: isCrisis ? 'crisis_elevation' : detected ? 'standard' : 'none',
    shouldSmooth: !isCrisis && detected,
    confidence: curr.confidence,
  }
}

/**
 * Handle context transition with custom handler
 * @deprecated Use ContextTransitionDetector with event listeners instead
 */
export async function handleContextTransition(
  transition: ContextTransition,
  handler: ContextTransitionHandler,
): Promise<void> {
  if (transition.detected) {
    await handler(transition)
  }
}
