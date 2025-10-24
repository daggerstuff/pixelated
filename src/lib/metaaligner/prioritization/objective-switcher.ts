// Objective Switching Mechanism for Real-Time Adaptation
// Updates system objectives upon context transition using mapping and weighting functions.

import { ContextEvent, ContextTransition } from './context-transition-detector'
import {
  getContextObjectives,
  ObjectivePriority,
} from './context-objective-mapping'
import { defaultWeightingStrategy } from './objective-weighting-strategy'

// Tracks the current stack/objectives for use by downstream modules
export class ObjectiveSwitcher {
  private currentObjectives: ObjectivePriority[] = []
  private lastContext?: ContextEvent

  constructor(initialContext?: ContextEvent) {
    if (initialContext) {
      this.currentObjectives = getContextObjectives(initialContext.contextType)
      this.lastContext = initialContext
    }
  }

  /**
   * Handles a context transition and updates current objectives.
   * Custom weighting params/strategies can be injected as needed.
   */
  public onContextTransition(
    transition: ContextTransition,
    weightingParams?: Record<string, any>,
  ) {
    if (!transition.detected) {
      return
    }

    const objectivesList = getContextObjectives(transition.to.contextType)
    this.currentObjectives = defaultWeightingStrategy(
      objectivesList,
      weightingParams || {},
    )
    this.lastContext = transition.to
  }

  /** Returns the currently prioritized objectives with weights */
  public getObjectives(): ObjectivePriority[] {
    return this.currentObjectives
  }
}
