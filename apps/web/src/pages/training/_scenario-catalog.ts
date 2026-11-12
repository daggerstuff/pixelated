/**
 * The approved training-scenario catalog: the data seam behind
 * `/training/scenarios` and `/training/sessions/new`.
 *
 * There is no approved catalog. The owner's 2026-11-11 grant allows the
 * structure and forbids authoring the content, so this module reads an artefact
 * (`_scenario-catalog.source.json`) that currently records the absence rather
 * than a list.
 *
 * `apps/web/src/data/scenarios.ts` holds an authored list of clinical scenarios
 * that the simulator consumes. It is **not** an approval and is deliberately
 * not read here: presenting it as the catalog would ship unapproved clinical
 * content behind a working-looking list, which is the one thing this scaffold
 * must not do.
 *
 * The loader fails closed. A malformed entry, a missing approver, or an
 * unparseable approval date yields `not-approved` with no partial list, so a
 * half-written artefact can never be rendered as an approved catalog. When the
 * owner approves a catalog, the artefact is replaced and this loader needs no
 * change.
 *
 * Lives beside the pages rather than in `lib/` because the granted area is
 * `apps/web/src/pages/training/**`; the leading underscore keeps Astro's router
 * from treating it as a route (the same convention as `_session-load-state.ts`).
 */
import {
  SCENARIO_CATALOG_BLOCKER,
  type ScaffoldBlocker,
} from './_scaffold-blockers'
import catalogSource from './_scenario-catalog.source.json'

/**
 * One entry of the approved catalog.
 *
 * Deliberately minimal: an identifier the owner assigns and the owner's own
 * display label. Clinical fields (vignette, difficulty, learning objectives)
 * are not modelled here, because modelling them would author the taxonomy the
 * grant forbids.
 */
export interface ApprovedScenario {
  /** Stable identifier assigned by the catalog owner. */
  readonly id: string
  /** The owner-approved display label. Never authored in this repository. */
  readonly label: string
}

/** The owner's approval of the catalog the scenarios came from. */
export interface ScenarioCatalogApproval {
  /** Who approved the catalog. */
  readonly approvedBy: string
  /** ISO-8601 timestamp of the approval. */
  readonly approvedAt: string
}

/** What a surface may render: an approved catalog, or an explicit absence. */
export type ScenarioCatalogSnapshot =
  | {
      readonly status: 'not-approved'
      /** The blocker every content-dependent element must render. */
      readonly blocker: ScaffoldBlocker
      /** Always empty: an unapproved catalog lists nothing. */
      readonly scenarios: readonly ApprovedScenario[]
    }
  | {
      readonly status: 'approved'
      readonly approval: ScenarioCatalogApproval
      readonly scenarios: readonly ApprovedScenario[]
    }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== ''

const readApproval = (value: unknown): ScenarioCatalogApproval | null => {
  if (!isRecord(value)) return null
  const approvedBy = value['approvedBy']
  const approvedAt = value['approvedAt']
  if (!isNonEmptyString(approvedBy) || !isNonEmptyString(approvedAt)) {
    return null
  }
  if (Number.isNaN(Date.parse(approvedAt))) return null
  return { approvedBy, approvedAt }
}

const readScenarios = (value: unknown): readonly ApprovedScenario[] | null => {
  if (!Array.isArray(value)) return null
  const scenarios: ApprovedScenario[] = []
  for (const entry of value) {
    if (!isRecord(entry)) return null
    const id = entry['id']
    const label = entry['label']
    if (!isNonEmptyString(id) || !isNonEmptyString(label)) return null
    scenarios.push({ id, label })
  }
  return scenarios
}

/**
 * Read the catalog artefact into the shape a surface renders.
 *
 * `source` is injectable so the validation rules are exercised directly; the
 * page always calls this with the shipped artefact.
 */
export const loadApprovedScenarioCatalog = (
  source: unknown = catalogSource,
): ScenarioCatalogSnapshot => {
  const notApproved = (): ScenarioCatalogSnapshot => ({
    status: 'not-approved',
    blocker: SCENARIO_CATALOG_BLOCKER,
    scenarios: [],
  })

  if (!isRecord(source)) return notApproved()

  const approval = readApproval(source['approval'])
  if (!approval) return notApproved()

  const scenarios = readScenarios(source['scenarios'])
  if (!scenarios) return notApproved()

  return { status: 'approved', approval, scenarios }
}
