// Context Transition Detection & Handling
// Tracks changes between detected context types (e.g., crisis, support, info, clinical) and invokes handlers.

import { ContextType } from '../core/objectives'

// Represents metadata associated with each context detection event
export interface ContextEvent {
  turnId: string | number
  contextType: ContextType
  meta?: Record<string, unknown>
  timestamp?: number
}

// Describes a transition between two context detection events
export interface ContextTransition {
  from: ContextEvent
  to: ContextEvent
  detected: boolean
}

// Handler signature for responding to transitions (extensible)
export type ContextTransitionHandler = (
  transition: ContextTransition,
) => void | Promise<void>

/**
 * Detects context transition between consecutive events.
 * Returns transition object with detected=true if type changed.
 */
export function detectContextTransition(
  prev: ContextEvent,
  curr: ContextEvent,
): ContextTransition {
  const detected = prev.contextType !== curr.contextType

  return {
    from: prev,
    to: curr,
    detected,
  }
}

/**
 * Example transition handling: logs, triggers pipeline, or adapts objectives.
 * Replace with appropriate logic for MetaAligner pipeline.
 */
export async function handleContextTransition(
  transition: ContextTransition,
  handler: ContextTransitionHandler,
) {
  if (transition.detected) {
    await handler(transition)
  }
}
