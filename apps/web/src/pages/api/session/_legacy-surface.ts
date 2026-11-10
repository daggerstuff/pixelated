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
 *
 * A second, different failure is mapped here as well. `lib/db` bounds every
 * statement client-side (`DB_QUERY_TIMEOUT_MS`, 4 000 ms, set on the pool as
 * `query_timeout`), and pg raises `Query read timeout` when that bound trips.
 * That is a temporary infrastructure condition, not a malformed request and not
 * a missing surface, so it must never be answered as `500` (the regression
 * measured on `249c558c4` / Worker `7542a5d3`) and must never be answered as
 * `410` (which would claim the surface is gone). It answers the retryable
 * `503` + `Retry-After` shape the rest of the application uses.
 */

const LEGACY_SCHEMA_ERROR_CODES = new Set(['42P01', '42703'])

/**
 * PostgreSQL `query_canceled`. The pool configures a server-side
 * `statement_timeout`, so a statement abandoned by that bound raises this code
 * with a `statement timeout` message — the same temporary condition as pg's
 * client-side `Query read timeout`, one layer further out.
 */
const STATEMENT_TIMEOUT_ERROR_CODE = '57014'

/** pg's client-side bound message (`query_timeout`). */
const QUERY_READ_TIMEOUT_MESSAGE = 'query read timeout'

/**
 * The bound messages raised by `lib/db`'s own deadline race
 * (`QueryTimeoutError`) and by its normalisation of a bound trip
 * (`DatabaseUnavailableError` wrapping one).
 */
const STATEMENT_BOUND_MESSAGES = [
  'database statement exceeded',
  'database statement could not complete within',
]

/** How far down an error's `cause` chain the bound is looked for. */
const MAX_CAUSE_DEPTH = 3

export const LEGACY_SESSION_SURFACE_CODE = 'LEGACY_SESSION_API_UNAVAILABLE'

/**
 * Stable code for the retryable shape. Distinct from the `410` code so a caller
 * (or an evidence run) can tell that the surface is gone apart from a
 * temporary failure.
 */
export const LEGACY_SESSION_RETRYABLE_CODE =
  'LEGACY_SESSION_API_TEMPORARILY_UNAVAILABLE'

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
 * True when the statement was abandoned by a bound rather than by a malformed
 * request or a missing surface.
 *
 * Deliberately narrow. A connection-level failure (`08006`), an acquisition
 * timeout and any other infrastructure error keep their existing `500`, because
 * this feature maps only the query-timeout class that the client-side bound
 * introduced.
 */
export function isQueryTimeout(error: unknown): boolean {
  return matchesQueryTimeout(error, 0)
}

function matchesQueryTimeout(error: unknown, depth: number): boolean {
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as {
    name?: unknown
    message?: unknown
    code?: unknown
    cause?: unknown
  }

  if (candidate.name === 'QueryTimeoutError') return true

  const message =
    typeof candidate.message === 'string' ? candidate.message.toLowerCase() : ''
  if (message.includes(QUERY_READ_TIMEOUT_MESSAGE)) return true
  if (STATEMENT_BOUND_MESSAGES.some((bound) => message.includes(bound))) {
    return true
  }
  if (
    candidate.code === STATEMENT_TIMEOUT_ERROR_CODE &&
    message.includes('statement timeout')
  ) {
    return true
  }

  // `lib/db` wraps a bound trip in `DatabaseUnavailableError`, keeping the
  // original as `cause`. The acquisition bound shares that wrapper but not
  // this message, so it is not matched.
  if (depth >= MAX_CAUSE_DEPTH) return false
  return matchesQueryTimeout(candidate.cause, depth + 1)
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

/**
 * `503` + `Retry-After` for a route whose statement hit the client-side bound.
 *
 * The database may be reachable on the next request, so this is the retryable
 * shape the training routes already use. The body is stable and deliberately
 * carries no pg error code, statement text, or table name.
 */
export function legacySessionRetryableResponse(): Response {
  return new Response(
    JSON.stringify({
      error: 'Legacy session analytics are temporarily unavailable',
      code: LEGACY_SESSION_RETRYABLE_CODE,
    }),
    {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '1',
        'Deprecation': 'true',
      },
    },
  )
}

/**
 * Roll back without masking the failure that caused the rollback.
 *
 * A statement abandoned by the client-side bound destroys the connection, and
 * pg then rejects the `ROLLBACK` with `Client has encountered a connection
 * error and is not queryable`. Letting that replace the original error would
 * turn a mapped `503` (or a mapped `410`) back into an unmapped `500`, so the
 * original is preserved and only the rollback failure is logged.
 */
export async function rollbackQuietly(client: {
  query: (text: string) => Promise<unknown>
}): Promise<void> {
  try {
    await client.query('ROLLBACK')
  } catch (error: unknown) {
    console.error('Legacy session route rollback failed:', error)
  }
}
