import type { Scenario } from '../types'
import { exampleScenarios } from '../utils/scenarios'

/**
 * Get all available scenarios (synchronous)
 */
export function getAllScenarios(): Scenario[] {
  return exampleScenarios
}

/**
 * Get a specific scenario by ID (synchronous)
 */
export function getScenarioById(id: string): Scenario | undefined {
  return exampleScenarios.find((scenario) => scenario.id === id)
}

export { exampleScenarios }
