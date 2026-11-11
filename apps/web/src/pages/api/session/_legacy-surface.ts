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
 *
 * A third class joins them on the same surface. These routes acquire their
 * client through `acquireClient()`, which raises `DatabaseUnavailableError`
 * when it cannot hand out a usable client: two consecutive reused clients fail
 * the liveness probe, or both acquisition attempts exceed their bound. That is
 * the same temporary condition as a bound trip, one stage earlier, so every
 * handler maps `isDatabaseUnavailableError()` alongside `isQueryTimeout()`.
 * Leaving it unmapped answered `500 Internal server error` — the worst possible
 * answer on a surface the availability matrix counts hard failures on.
 *
 * A fourth class is not a database condition at all. A request whose body is
 * not JSON, or whose session identifier is not a UUID, used to reach the
 * statement and come back as `500` (`22P02` for the identifier, a thrown
 * `SyntaxError` for the body). Those are malformed requests, so they answer
 * `400` with a stable body before any SQL runs. A genuine infrastructure
 * failure keeps its `500`.
 */

import {
  resolveInternalUserId,
  type SessionPrincipal,
} from '../../../lib/auth/internal-identity'
import { isDatabaseUnavailableError } from '../../../lib/db'

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
 * Deliberately narrow: it classifies the statement bound only. The client
 * acquisition class is classified by `isDatabaseUnavailableError()` in
 * `lib/db` and mapped beside this one in every handler; a genuine
 * non-availability infrastructure error still answers `500`.
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

export interface LegacyRetryableOptions {
  /**
   * Advertise a retry through `Retry-After`.
   *
   * Reads are safe to retry. A POST's write may have committed before its
   * bound tripped, so the route withholds the advertisement instead of inviting
   * a retry that could insert the same evaluation, milestone, comparison or
   * analytics row twice. The `503` itself is unchanged: a temporary failure is
   * never reported as a `500`.
   */
  advertiseRetry?: boolean
}

/**
 * `503` for a route whose statement hit the client-side bound.
 *
 * The database may be reachable on the next request, so this is the retryable
 * shape the training routes already use. The body is stable and deliberately
 * carries no pg error code, statement text, or table name.
 */
export function legacySessionRetryableResponse(
  options: LegacyRetryableOptions = {},
): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Deprecation': 'true',
  }
  if (options.advertiseRetry !== false) headers['Retry-After'] = '1'
  return new Response(
    JSON.stringify({
      error: 'Legacy session analytics are temporarily unavailable',
      code: LEGACY_SESSION_RETRYABLE_CODE,
    }),
    { status: 503, headers },
  )
}

/**
 * Stable code for a request the surface cannot understand: a body that is not
 * JSON, or a session identifier that is not a UUID. Distinct from the `410`
 * exclusion code and from the retryable `503` code, so a caller can tell
 * malformed input apart from a gone surface and apart from a retryable failure.
 */
export const LEGACY_SESSION_INVALID_REQUEST_CODE =
  'LEGACY_SESSION_INVALID_REQUEST'

/**
 * Canonical UUID shape, plus the hyphen-less 32-hex form PostgreSQL also
 * accepts. Both cast cleanly against `sessions.id`; anything else raises
 * `22P02` (`invalid input syntax for type uuid`) inside the statement, which is
 * what this guard exists to prevent.
 */
const LEGACY_SESSION_ID_PATTERN =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32})$/i

/**
 * True when `value` is a shape PostgreSQL will cast to `uuid` without raising.
 */
export function isLegacySessionId(value: unknown): value is string {
  return typeof value === 'string' && LEGACY_SESSION_ID_PATTERN.test(value)
}

/**
 * `400` for a request that is malformed rather than unauthorized or
 * temporarily failing.
 *
 * The body is stable and carries no pg error code, statement text, or table
 * name: the caller is told what shape was expected, never what the database
 * said. A genuine infrastructure failure keeps the handler's `500` path; this
 * response is only for input the surface can classify itself.
 */
export function legacySessionInvalidRequestResponse(message: string): Response {
  return new Response(
    JSON.stringify({
      error: message,
      code: LEGACY_SESSION_INVALID_REQUEST_CODE,
    }),
    {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

/**
 * `410` for a malformed identifier on one of the routes excluded from the
 * pilot surface.
 *
 * `progress`, `comparison` and `analytics` are excluded regardless of body
 * shape, so a malformed identifier takes the same `410` path a well-formed one
 * takes rather than introducing a `400` the exclusion contract does not have.
 * The guard exists because PostgreSQL raises `22P02` on the uuid cast while the
 * first ownership statement is analysed, before that statement can resolve the
 * absent legacy relation, which used to surface as a `500`.
 *
 * The response is identical to `legacySessionSurfaceResponse()`: the caller
 * learns that the surface is gone, never what the database said about the
 * identifier. No pg error code, statement fragment or table name is included.
 */
export function legacySessionExcludedInvalidIdResponse(): Response {
  return legacySessionSurfaceResponse()
}

/**
 * Resolve the caller's internal `users.id`, mapping a retryable
 * database-availability failure to the route's `503` instead of denying an
 * authenticated caller with `403`.
 *
 * `propagateDatabaseErrors` makes an acquisition stall, a bound trip and a
 * transient connection error throw instead of reporting an unresolved
 * identity. All of them are retryable, so they answer the same `503` the
 * statement path uses; any other failure keeps the `null` contract, which the
 * caller answers as `403`.
 *
 * `advertiseRetry` is forwarded to `legacySessionRetryableResponse()`. A POST
 * handler passes `false` so this branch and the handler's own `catch` agree: a
 * POST may have written, so neither advertises a retry delay. A GET leaves it
 * at the default and keeps advertising one.
 *
 * @returns the internal UUID, `null` when the identity cannot be resolved, or
 *   the `503` response to return as-is
 */
export async function resolveLegacyTherapistId(
  principal: SessionPrincipal | null | undefined,
  options: LegacyRetryableOptions = {},
): Promise<string | null | Response> {
  try {
    return await resolveInternalUserId(principal, {
      propagateDatabaseErrors: true,
    })
  } catch (error: unknown) {
    if (isDatabaseUnavailableError(error)) {
      return legacySessionRetryableResponse({
        advertiseRetry: options.advertiseRetry,
      })
    }
    throw error
  }
}

/**
 * Roll back without masking the failure that caused the rollback, and report
 * whether the client must be destroyed instead of returned to the pool.
 *
 * A statement abandoned by the client-side bound leaves a half-consumed
 * protocol stream behind, and a lost connection has no socket left; pg then
 * rejects the `ROLLBACK` with `Client has encountered a connection error and is
 * not queryable`. Letting that replace the original error would turn a mapped
 * `503` (or a mapped `410`) back into an unmapped `500`, so the original is
 * preserved. Those clients are destroyed by the caller (`release(true)`), which
 * is how `lib/db`'s own `transaction()` treats them; a `ROLLBACK` on them would
 * only wait out the same bound again.
 *
 * @returns true when the caller must release the client with `release(true)`
 */
export async function rollbackQuietly(
  client: { query: (text: string) => Promise<unknown> },
  error: unknown,
): Promise<boolean> {
  if (isDatabaseUnavailableError(error)) return true
  try {
    await client.query('ROLLBACK')
    return false
  } catch (rollbackError: unknown) {
    console.error('Legacy session route rollback failed:', rollbackError)
    return true
  }
}
