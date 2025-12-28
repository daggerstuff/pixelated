// Context-to-Objective Mapping System for MetaAligner
// Maps detected context types to prioritized objectives for multi-objective alignment.

import { ContextType } from '../core/objectives'

/**
 * Core alignment objectives as string enums for clarity.
 */
export enum ObjectiveKey {
  Correctness = 'correctness',
  Informativeness = 'informativeness',
  Professionalism = 'professionalism',
  Empathy = 'empathy',
  Safety = 'safety',
  Support = 'support',
}

export interface ObjectivePriority {
  key: ObjectiveKey
  priority: number // 1 = highest, larger = lower priority
  weight: number // 0..1 normalized for weighting algorithms
}

/**
 * Mapping from a context type to a prioritized list of objectives.
 * The list order and weighting can be adjusted per domain needs.
 */
const contextObjectiveMap: Record<ContextType, ObjectivePriority[]> = {
  [ContextType.CRISIS]: [
    { key: ObjectiveKey.Safety, priority: 1, weight: 1.0 },
    { key: ObjectiveKey.Empathy, priority: 2, weight: 0.8 },
    { key: ObjectiveKey.Correctness, priority: 3, weight: 0.7 },
    { key: ObjectiveKey.Professionalism, priority: 4, weight: 0.6 },
  ],
  [ContextType.EDUCATIONAL]: [
    { key: ObjectiveKey.Informativeness, priority: 1, weight: 1.0 },
    { key: ObjectiveKey.Correctness, priority: 2, weight: 0.9 },
    { key: ObjectiveKey.Professionalism, priority: 3, weight: 0.7 },
    { key: ObjectiveKey.Empathy, priority: 4, weight: 0.5 },
  ],
  [ContextType.SUPPORT]: [
    { key: ObjectiveKey.Empathy, priority: 1, weight: 1.0 },
    { key: ObjectiveKey.Support, priority: 2, weight: 0.9 },
    { key: ObjectiveKey.Professionalism, priority: 3, weight: 0.7 },
    { key: ObjectiveKey.Correctness, priority: 4, weight: 0.6 },
  ],
  [ContextType.CLINICAL_ASSESSMENT]: [
    { key: ObjectiveKey.Correctness, priority: 1, weight: 1.0 },
    { key: ObjectiveKey.Professionalism, priority: 2, weight: 0.9 },
    { key: ObjectiveKey.Empathy, priority: 3, weight: 0.7 },
    { key: ObjectiveKey.Safety, priority: 4, weight: 0.7 },
  ],
  [ContextType.INFORMATIONAL]: [
    { key: ObjectiveKey.Informativeness, priority: 1, weight: 1.0 },
    { key: ObjectiveKey.Correctness, priority: 2, weight: 0.9 },
    { key: ObjectiveKey.Professionalism, priority: 3, weight: 0.7 },
  ],
  [ContextType.GENERAL]: [
    { key: ObjectiveKey.Correctness, priority: 1, weight: 0.8 },
    { key: ObjectiveKey.Professionalism, priority: 2, weight: 0.7 },
    { key: ObjectiveKey.Empathy, priority: 3, weight: 0.6 },
  ],
}

/**
 * Returns prioritized objectives for the given context type.
 * Falls back to GENERAL if the supplied context is unrecognized.
 */
export function getPrioritizedObjectivesForContext(
  context: ContextType,
): ObjectivePriority[] {
  return (
    contextObjectiveMap[context] ?? contextObjectiveMap[ContextType.GENERAL]
  )
}
