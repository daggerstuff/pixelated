/**
 * The session-creation code path.
 *
 * `/training/sessions/new` renders the surface and posts to it. This module is
 * the decision that sits in front of the write: it takes the catalog snapshot
 * and the scenario the trainee selected and returns the decisions that still
 * stand between the request and a `sessions` row. It never writes.
 *
 * The write is deliberately absent, not forgotten. A training session is a
 * `sessions` row with `session_type='training'` and a `context.clientProfile`
 * that `lib/services/training/session-api.ts` requires (name, age, gender,
 * personality type, presenting problem) plus `context.difficultyLevel`. Those
 * values come from an approved scenario, and mapping a scenario onto them is a
 * product decision that has not been made. Inventing values would put authored
 * clinical content behind a working-looking control.
 *
 * Lives beside the pages rather than in `lib/` because the granted area is
 * `apps/web/src/pages/training/**`; the leading underscore keeps Astro's router
 * from treating it as a route (the same convention as `_session-load-state.ts`).
 */
import {
  SCENARIO_CATALOG_BLOCKER,
  SCENARIO_NOT_SELECTED_BLOCKER,
  SCENARIO_SESSION_TEMPLATE_BLOCKER,
  type ScaffoldBlocker,
} from './_scaffold-blockers'
import type {
  ApprovedScenario,
  ScenarioCatalogSnapshot,
} from './_scenario-catalog'

/** What the creation path decided for one request. */
export interface SessionCreationPlan {
  /**
   * Every decision that still blocks the write, in the order a reader should
   * consider them. An empty list would mean the request may proceed.
   */
  readonly blockers: readonly ScaffoldBlocker[]
  /** The selected scenario, when the approved catalog contains it. */
  readonly scenario: ApprovedScenario | null
}

/**
 * Decide whether a request may create a training session.
 *
 * Pure: it reads the catalog snapshot it is given and returns blockers. It has
 * no database access, which is what makes the scaffold safe to expose while the
 * content is unapproved.
 */
export const planTrainingSessionCreation = (
  catalog: ScenarioCatalogSnapshot,
  scenarioId: string | null,
): SessionCreationPlan => {
  const blockers: ScaffoldBlocker[] = []

  if (catalog.status !== 'approved') {
    blockers.push(SCENARIO_CATALOG_BLOCKER)
  }

  const scenario =
    catalog.scenarios.find((candidate) => candidate.id === scenarioId) ?? null

  if (catalog.status === 'approved' && scenario === null) {
    blockers.push(SCENARIO_NOT_SELECTED_BLOCKER)
  }

  // Present in every state until the product owner records the mapping.
  blockers.push(SCENARIO_SESSION_TEMPLATE_BLOCKER)

  return { blockers, scenario }
}

/**
 * Read the scenario a form submission named.
 *
 * A malformed body is a refusal, not a 500: the creation path cannot act on a
 * request it could not parse, and the page renders the same blocker set.
 */
export const readSubmittedScenarioId = async (
  request: Request,
): Promise<string | null> => {
  try {
    const form = await request.formData()
    const value = form.get('scenario')
    return typeof value === 'string' && value !== '' ? value : null
  } catch {
    return null
  }
}
