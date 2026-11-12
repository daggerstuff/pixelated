/**
 * The product decisions the training-journey scaffolding is waiting on.
 *
 * The 2026-11-11 grant allows the journey surfaces to be built as structure and
 * forbids authoring the content they depend on. A blocker is therefore part of
 * the surface, not a footnote: every content-dependent element renders one, and
 * none of them may invent the thing it names.
 *
 * Owners are roles, not people. A role survives staff changes, and it is what a
 * reviewer of this scaffold needs in order to know who unblocks it.
 *
 * Lives beside the pages rather than in `lib/` because the granted area is
 * `apps/web/src/pages/training/**`; the leading underscore keeps Astro's router
 * from treating it as a route (the same convention as `_session-load-state.ts`).
 */
export interface ScaffoldBlocker {
  /** Stable machine-readable id, so a reviewer can grep for the decision. */
  readonly id: string
  /** The role that owns the decision. */
  readonly owner: string
  /** One sentence the trainee reads first. */
  readonly headline: string
  /** Why the surface cannot do the thing yet. */
  readonly detail: string
}

/**
 * There is no approved scenario catalog.
 *
 * `apps/web/src/data/scenarios.ts` holds an authored list of clinical scenarios
 * that the simulator consumes. It is not an approval, and it is deliberately
 * not read by the catalog surface: presenting it as "the catalog" would ship
 * unapproved clinical content behind a working-looking list.
 */
export const SCENARIO_CATALOG_BLOCKER: ScaffoldBlocker = {
  id: 'scenario-catalog-not-approved',
  owner: 'Clinical content owner',
  headline: 'Awaiting the approved scenario catalog',
  detail:
    "No approved scenario catalog exists as an artefact. Scenario names, clinical vignettes, difficulty levels, and learning objectives are the clinical content owner's decision, so this surface deliberately lists none of them.",
}

/**
 * Even with an approved catalog, a scenario is not yet a session.
 *
 * The training session read path (`lib/services/training/session-api.ts`)
 * requires `context.clientProfile` (name, age, gender, personality type,
 * presenting problem) and `context.difficultyLevel` before it will return a
 * session. Turning an approved scenario into those values is a product
 * decision, so the creation path stops before it writes anything.
 */
export const SCENARIO_SESSION_TEMPLATE_BLOCKER: ScaffoldBlocker = {
  id: 'scenario-session-template-not-approved',
  owner: 'Product owner',
  headline: 'Awaiting the approved scenario-to-session template',
  detail:
    'A training session needs the client profile the session read path requires, plus a difficulty level. Mapping an approved scenario onto those fields is a product decision, so session creation stops before it writes anything.',
}

/**
 * An approved catalog exists but the request did not name one of its entries.
 *
 * This is a request-state blocker rather than an owner decision: it disappears
 * as soon as a trainee selects an approved scenario.
 */
export const SCENARIO_NOT_SELECTED_BLOCKER: ScaffoldBlocker = {
  id: 'scenario-not-selected',
  owner: 'Clinical content owner',
  headline: 'No approved scenario is selected',
  detail:
    'Session creation starts from an approved scenario. Select one from the approved catalog; until the catalog is approved there is nothing to select.',
}
