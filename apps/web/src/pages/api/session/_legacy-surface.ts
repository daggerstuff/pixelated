/**
 * Shared behaviour for the legacy `/api/session/*` routes.
 *
 * These four routes (progress, skills, comparison, analytics) query schema that
 * does not exist in the deployed database: the `evaluations`,
 * `skill_development`, `session_comparisons`, and `session_analytics` tables,
 * plus the `sessions.progress_metrics`, `sessions.progress_snapshots`, and
 * `sessions.skill_scores` columns. Every authenticated call therefore failed
 * with a 5xx (PostgreSQL `42P01` / `42703`), which is a defect finding, not a
 * denial.
 *
 * The routes are excluded from the pilot surface until the analytics contract
 * they imply is defined. Until then they answer `410 Gone` with a stable,
 * non-leaking body so callers and evidence runs get an explicit, documented
 * status instead of a 500. `410` is deliberate: `501 Not Implemented` is a 5xx,
 * and a 5xx is never a denial — the contract requires a non-5xx exclusion
 * status. Do not create the missing tables here: their semantics are undefined
 * (see the mission's exclusion decision).
 *
 * `/api/session/snapshots` joins the same exclusion treatment: it reads
 * `sessions.progress_snapshots` and `session_milestones`, and production has
 * neither, so it maps the same `42P01` / `42703` errors to this response.
 */

const LEGACY_SCHEMA_ERROR_CODES = new Set(['42P01', '42703'])

export const LEGACY_SESSION_SURFACE_CODE = 'LEGACY_SESSION_API_UNAVAILABLE'

/**
 * True when PostgreSQL reports a missing relation (`42P01`) or column
 * (`42703`) — i.e. the legacy route's schema is absent.
 */
export function isMissingLegacySchema(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' && LEGACY_SCHEMA_ERROR_CODES.has(code)
}

/**
 * `410 Gone` for a route excluded from the pilot surface.
 * Deliberately carries no schema, table, or user detail.
 */
export function legacySessionSurfaceResponse(): Response {
  return new Response(
    JSON.stringify({
      error: 'Legacy session analytics are not available',
      code: LEGACY_SESSION_SURFACE_CODE,
    }),
    {
      status: 410,
      headers: {
        'Content-Type': 'application/json',
        'Deprecation': 'true',
      },
    },
  )
}
