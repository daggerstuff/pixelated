/**
 * Database connection and utility functions for Pixelated
 * Supports PostgreSQL with connection pooling and migration management
 */

import { createHash } from 'crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { Pool, PoolClient } from 'pg'

import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { parseDatabaseUrl } from './parse-database-url'
import { recordQuery } from './query-counting'
import { DEFAULT_WORKSPACE_SLUG, WorkspaceResolutionError } from './workspace'
const logger = createBuildSafeLogger('index')

// pg does not export these types; define locally
export type QueryResultRow = Record<string, any>
export interface DbQueryResult<T = QueryResultRow> {
  rows: T[]
  rowCount: number
  command?: string
  oid?: number
  fields?: Array<{ name: string; dataTypeID: number }>
}

// Pool's runtime properties not exposed in pg type definitions.
// Accessed via `as unknown as T` — safer than `as any` because it requires
// explicit acknowledgement that the shape is compiler-unknown.
interface PoolWithConnectEvent {
  on(event: 'connect', listener: (client: PoolClient) => void): this
}

// Database configuration
export interface DatabaseConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
  max: number
  idleTimeoutMillis: number
  connectionTimeoutMillis: number
  acquireTimeoutMillis: number
  statementTimeoutMillis: number
  queryTimeoutMillis: number
  livenessProbeTimeoutMillis: number
  clientLifetimeSeconds: number
  keepAlive: boolean
  keepAliveInitialDelayMillis: number
  ssl?: boolean | object
}

/**
 * Upper bound on a single Postgres client-acquisition attempt.
 *
 * pg's `connectionTimeoutMillis` used to be the only bound on
 * `getPool().connect()` — 15 000 ms, 1.875x the training route's 8 s deadline —
 * and `acquireClient` retried only on a *raised* transient error, so a
 * `connect()` that never settled was neither bounded nor retried. The measured
 * read-path stall sat in exactly that stage for 7 974–7 999 ms (diagnosis D3).
 * This bound is enforced by `acquireClient` itself, so it holds even when pg's
 * own timer never fires.
 *
 * Override with `DB_ACQUIRE_TIMEOUT`; `0` (or any non-positive value) disables
 * this bound, as it does for the liveness-probe, client-lifetime and statement
 * bounds. Without that guard `setTimeout(…, 0)` fired before `connect()` could
 * settle, so `DB_ACQUIRE_TIMEOUT=0` made every acquisition fail immediately
 * instead of disabling the bound — the same trap `DB_QUERY_TIMEOUT` had, one
 * layer down. A negative value means the same thing, because `setTimeout`
 * clamps a negative delay to `0`. A non-numeric value keeps this default rather
 * than disabling the bound.
 *
 * Disabling it leaves pg's own `connectionTimeoutMillis`
 * (`DB_CONNECTION_TIMEOUT`, 3 000 ms by default) as the acquisition bound, so a
 * caller still cannot hang indefinitely; it only removes this module's tighter
 * race and its pool rebuild.
 */
export const DB_ACQUIRE_TIMEOUT_MS = 2_500

/**
 * Acquisition attempts. One retry, on a freshly rebuilt pool, so a stale
 * socket self-heals instead of failing the request.
 *
 * `DB_ACQUIRE_TIMEOUT_MS * DB_ACQUIRE_ATTEMPTS` (5 000 ms) must stay below the
 * request deadline (`TRAINING_DATA_DEADLINE_MS`, 8 000 ms), so a hung
 * acquisition becomes a fast, retryable failure rather than the deadline's 503.
 */
export const DB_ACQUIRE_ATTEMPTS = 2

/**
 * Upper bound on a single statement, enforced by the server
 * (`statement_timeout`). It is shorter than the request deadline so a stuck
 * first statement cannot occupy the same silence an unbounded connect did.
 *
 * Override with `DB_STATEMENT_TIMEOUT`. `0` (or any non-positive value)
 * disables the bound for long maintenance statements. A negative value is
 * normalised to `0` before the pool is built, because pg forwards
 * `statement_timeout` verbatim as a startup parameter (`if
 * (params.statement_timeout)` is truthy for a negative) and PostgreSQL refuses
 * the connection. A non-numeric value keeps this default.
 */
export const DB_STATEMENT_TIMEOUT_MS = 5_000

/**
 * Upper bound on one pool connect/checkout (`connectionTimeoutMillis`). It also
 * bounds callers that use `getPool().query()` directly, which bypass
 * `acquireClient`.
 *
 * Override with `DB_CONNECTION_TIMEOUT`. `0` (or any non-positive value)
 * disables the bound. pg-pool tests the option for truthiness
 * (`if (!this.options.connectionTimeoutMillis)`), so a negative value would
 * schedule `setTimeout(…, -N)` and destroy every connecting or queued client,
 * and pg derives the libpq `connect_timeout` from it, which PostgreSQL rejects
 * when negative. A negative value is therefore normalised to `0` before the
 * pool is built. A non-numeric value keeps this default.
 */
export const DB_CONNECTION_TIMEOUT_MS = 3_000

/**
 * Upper bound on a single statement, enforced client-side.
 *
 * Measured on `a24ab11d9` / Worker `e9aed1a4`: 35 of 35 successful session
 * loads opened a new Postgres connection, 38 of 38 deadline legs opened none,
 * and on a deadline leg nothing logged an acquisition failure, a
 * `DatabaseUnavailableError`, an idle-client error or an exception. The request
 * therefore held a *reused* pooled client whose socket never answered. The pool
 * set `connectionTimeoutMillis` and `idleTimeoutMillis` but no `query_timeout`,
 * and the session path never set `statement_timeout`, so a statement on such a
 * socket had no bound at all — the route's 8 s deadline was the only thing that
 * ended it.
 *
 * This is set on the pool (`query_timeout`), so it covers every caller
 * including statements issued directly on a client, and it is also enforced by
 * this module's own `query()`/`transaction()` so it holds even when pg's timer
 * never fires. A trip raises `DatabaseUnavailableError`, which the routes
 * already answer with the retryable `503` + `Retry-After`.
 *
 * It sits well inside the 8 s request deadline and well above a healthy
 * statement (measured: first query 94–263 ms after connect, 1 188 ms worst-case
 * connect). Override with `DB_QUERY_TIMEOUT`; `0` (or any non-positive value)
 * disables the bound, as it does for the liveness-probe and client-lifetime
 * bounds. A negative value is normalised to `0` before it reaches pg, which
 * would otherwise schedule an immediate timeout and reintroduce the defect one
 * layer down.
 */
export const DB_QUERY_TIMEOUT_MS = 4_000

/**
 * Maximum age of a pooled client before it is recycled.
 *
 * A Cloudflare isolate can freeze with clients in the pool; a peer (Neon, or a
 * middlebox) can close those sockets while the isolate is idle, and pg then
 * hands a dead socket to the next request. `idleTimeoutMillis` alone does not
 * cover that, because its timer does not run while the isolate is frozen.
 *
 * pg-pool has its own `maxLifetimeSeconds`, but its implementation calls
 * `.unref()` on the timer unconditionally, and `setTimeout` returns a number in
 * the Workers runtime — enabling it throws on every new client. The bound is
 * therefore enforced by `acquireClient`, which destroys a client that is
 * already past it instead of handing it to a statement. Override with
 * `DB_MAX_LIFETIME_SECONDS`; `0` disables the bound.
 */
export const DB_MAX_LIFETIME_SECONDS = 60

/**
 * Upper bound on the liveness probe a borrowed pooled client must pass before
 * it is handed to a caller.
 *
 * Measured on `249c558c4` / Worker `7542a5d3` (evidence
 * `availability-remeasure-249c558c4-2026-11-10.md` §6): every failing request
 * was served by a **reused** pooled client whose socket never answered, and
 * every success was served by one the pool had just opened. A socket can die
 * well inside `DB_MAX_LIFETIME_SECONDS`, so the lifetime recycle cannot catch
 * it, and the 4 000 ms statement bound only turns the dead socket into a
 * bounded failure after the caller has already issued its statement.
 *
 * A trivial `SELECT 1` on the borrowed client, bounded by this short deadline,
 * proves the socket answers *before* the caller's statement runs. A failure
 * destroys the client and replaces it; the caller never sees the probe. It is
 * deliberately a fraction of `DB_QUERY_TIMEOUT_MS`, so a healthy reused
 * acquire pays one round trip and a dead one costs a few hundred milliseconds,
 * not the statement bound.
 *
 * Measured cost of that round trip on a healthy acquire (host-side, against the
 * same Neon database, 50 samples): p50 13.2 ms, p95 13.4 ms, max 14.2 ms. A
 * fresh connect costs p50 153 ms, and it is not probed. The bound is therefore
 * ~22x the measured p95: a healthy client never trips it, and a dead socket
 * costs a fraction of the 4 000 ms statement bound.
 *
 * Override with `DB_LIVENESS_PROBE_TIMEOUT`; `0` disables the probe.
 */
export const DB_LIVENESS_PROBE_TIMEOUT_MS = 300

/**
 * The probe statement. Trivial, side-effect free, and valid on every
 * PostgreSQL version the deployment targets.
 */
const DB_LIVENESS_PROBE_STATEMENT = 'SELECT 1'

/**
 * How many reused clients one acquisition may destroy after a failed probe
 * before giving up with a retryable failure. The first failure is followed by
 * one replacement acquisition; if that replacement is itself a reused client
 * and also fails its probe, the pool is discarded and the caller receives a
 * `DatabaseUnavailableError` (a retryable 503) instead of a client that cannot
 * answer.
 */
const DB_LIVENESS_PROBE_TRIPS = 2

/**
 * Initial delay before the first TCP keepalive probe. Node honours this;
 * `pg-cloudflare` implements `setKeepAlive()` as a no-op, so on the Worker the
 * keepalive is declarative and the lifetime bound above is what actually
 * recycles a stale socket.
 */
const DB_KEEPALIVE_INITIAL_DELAY_MS = 10_000

/**
 * How many clients already past their lifetime one acquisition may recycle
 * before giving up and using the one it holds. The pool is capped at `max`
 * clients (20 by default), so a full pool of stale sockets is drained in one
 * pass and the next client the pool creates is fresh.
 */
const DB_CLIENT_RECYCLE_LIMIT = 20

/**
 * Documented default idle-client timeout (`DB_IDLE_TIMEOUT`, 30 000 ms).
 *
 * `0` (or any non-positive value) disables pg-pool's idle eviction. A negative
 * value is normalised to `0` before the pool is built, because pg-pool's
 * `if (this.options.idleTimeoutMillis)` is a truthiness test: a negative value
 * is truthy and schedules `setTimeout(…, -N)`, which evicts every client the
 * moment it is released and makes the pool reconnect per query. A non-numeric
 * value keeps this default.
 */
const DB_IDLE_TIMEOUT_MS_DEFAULT = 30_000

/**
 * Documented default pool size (`DB_MAX_CONNECTIONS`, 20).
 *
 * The pool size has no disabling value: pg-pool does
 * `max || poolSize || 10`, so `0` silently becomes 10 rather than meaning
 * anything, and a negative `max` makes `_isFull()` true forever, so every
 * `connect()` queues and then dies on the connection timeout. A non-positive
 * or non-finite value is therefore normalised back to this default instead of
 * being passed through. A non-numeric value keeps it too.
 */
const DB_MAX_CONNECTIONS_DEFAULT = 20

/**
 * Resolve the database configuration from the environment.
 *
 * Precedence (lowest to highest):
 *   1. Local development defaults
 *   2. DATABASE_URL (parsed)
 *   3. Explicit DB_* environment variables
 *
 * The production completeness check is performed in initializeDatabase()
 * after caller-supplied config has been merged.
 */
function resolveDefaultConfig(): DatabaseConfig {
  const env = process.env
  const databaseUrl = env['DATABASE_URL']

  const fromUrl: Partial<DatabaseConfig> = databaseUrl
    ? parseDatabaseUrl(databaseUrl)
    : {}

  const fromEnv: Partial<DatabaseConfig> = {}
  if (env['DB_HOST']) fromEnv.host = env['DB_HOST']
  // DB_PORT is the one numeric knob that cannot ride through `envInt`: its
  // fallback is the port DATABASE_URL carries, which `envInt` cannot see. A
  // bare `parseInt` resolved a non-numeric value to `NaN`, which pg forwards as
  // the port so every connection fails with an unhelpful error; `0` and
  // out-of-range values are no better. An unusable value is rejected here, so
  // the URL's port (or the 5432 default) applies instead of a port pg cannot
  // dial.
  const port = Number(env['DB_PORT'])
  if (Number.isInteger(port) && port > 0 && port <= 65_535) {
    fromEnv.port = port
  }
  if (env['DB_NAME']) fromEnv.database = env['DB_NAME']
  if (env['DB_USER']) fromEnv.user = env['DB_USER']
  if (env['DB_PASSWORD'] !== undefined) fromEnv.password = env['DB_PASSWORD']

  // A variable that is set but empty falls back to the default rather than
  // resolving to NaN (which pg would treat as "no timeout").
  const envInt = (name: string, fallback: number): number => {
    const raw = env[name]
    if (raw === undefined || raw === '') return fallback
    const parsed = parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  // Numeric knobs ride in `fromEnv` so the final spread applies them after
  // `fromUrl`: an explicit DB_* variable outranks the same option in
  // DATABASE_URL, which is the documented precedence. A variable that is set
  // but empty keeps the default (never NaN, which pg reads as "no timeout").
  if (env['DB_MAX_CONNECTIONS'] !== undefined)
    fromEnv.max = envInt('DB_MAX_CONNECTIONS', DB_MAX_CONNECTIONS_DEFAULT)
  if (env['DB_IDLE_TIMEOUT'] !== undefined)
    fromEnv.idleTimeoutMillis = envInt(
      'DB_IDLE_TIMEOUT',
      DB_IDLE_TIMEOUT_MS_DEFAULT,
    )
  if (env['DB_CONNECTION_TIMEOUT'] !== undefined) {
    fromEnv.connectionTimeoutMillis = envInt(
      'DB_CONNECTION_TIMEOUT',
      DB_CONNECTION_TIMEOUT_MS,
    )
  }
  if (env['DB_ACQUIRE_TIMEOUT'] !== undefined)
    fromEnv.acquireTimeoutMillis = envInt(
      'DB_ACQUIRE_TIMEOUT',
      DB_ACQUIRE_TIMEOUT_MS,
    )
  if (env['DB_STATEMENT_TIMEOUT'] !== undefined) {
    fromEnv.statementTimeoutMillis = envInt(
      'DB_STATEMENT_TIMEOUT',
      DB_STATEMENT_TIMEOUT_MS,
    )
  }
  if (env['DB_QUERY_TIMEOUT'] !== undefined)
    fromEnv.queryTimeoutMillis = envInt('DB_QUERY_TIMEOUT', DB_QUERY_TIMEOUT_MS)
  if (env['DB_LIVENESS_PROBE_TIMEOUT'] !== undefined) {
    fromEnv.livenessProbeTimeoutMillis = envInt(
      'DB_LIVENESS_PROBE_TIMEOUT',
      DB_LIVENESS_PROBE_TIMEOUT_MS,
    )
  }
  if (env['DB_MAX_LIFETIME_SECONDS'] !== undefined) {
    fromEnv.clientLifetimeSeconds = envInt(
      'DB_MAX_LIFETIME_SECONDS',
      DB_MAX_LIFETIME_SECONDS,
    )
  }

  const isLocalHost = (host?: string) =>
    !host || host === 'localhost' || host === '127.0.0.1' || host === '::1'
  const effectiveHost: string | undefined = fromEnv.host ?? fromUrl.host

  return {
    host: 'localhost',
    port: 5432,
    database: 'pixelated',
    user: 'postgres',
    password: '',
    max: DB_MAX_CONNECTIONS_DEFAULT,
    idleTimeoutMillis: DB_IDLE_TIMEOUT_MS_DEFAULT,
    connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MS,
    acquireTimeoutMillis: DB_ACQUIRE_TIMEOUT_MS,
    statementTimeoutMillis: DB_STATEMENT_TIMEOUT_MS,
    queryTimeoutMillis: DB_QUERY_TIMEOUT_MS,
    livenessProbeTimeoutMillis: DB_LIVENESS_PROBE_TIMEOUT_MS,
    clientLifetimeSeconds: DB_MAX_LIFETIME_SECONDS,
    keepAlive: true,
    keepAliveInitialDelayMillis: DB_KEEPALIVE_INITIAL_DELAY_MS,
    // Verify server certificates in production by default for remote hosts.
    // Localhost never uses SSL, even in production — the local Postgres does
    // not support TLS and would throw "The server does not support SSL connections".
    // Opt out only via an explicit sslmode=no-verify or disable in DATABASE_URL.
    ssl:
      env['NODE_ENV'] === 'production' && !isLocalHost(effectiveHost)
        ? { rejectUnauthorized: true }
        : false,
    ...fromUrl,
    ...fromEnv,
  }
}

// Connection pool
let pool: Pool | null = null
let lastConfig: Partial<DatabaseConfig> = {}
// The effective configuration of the live pool (defaults + caller config), so
// acquireClient can read its own bound without re-resolving the environment.
let activeConfig: DatabaseConfig | null = null

// When each pooled client connected. Used to recycle a client that has outlived
// `clientLifetimeSeconds` before it is handed to a statement.
const clientConnectedAt = new WeakMap<PoolClient, number>()

// Clients that have already been checked out at least once, so the acquire log
// can say whether this request opened a connection or reused a pooled one.
const checkedOutClients = new WeakSet<PoolClient>()

/**
 * Clamp a pool-option bound to the range pg reads as intended.
 *
 * `0` is pg's documented "no timeout" for `statement_timeout`, `query_timeout`,
 * `connectionTimeoutMillis` and `idleTimeoutMillis`. A negative value is *not*
 * read the same way: pg forwards `statement_timeout` verbatim as a startup
 * parameter and PostgreSQL refuses the connection, while pg-pool's
 * `if (options.connectionTimeoutMillis)` / `if (options.idleTimeoutMillis)`
 * truthiness tests schedule `setTimeout(…, -N)`, which fires on the next turn
 * and destroys or evicts every client. A non-finite value is no better.
 * Anything that is not a positive finite number therefore becomes `0`, which
 * disables the bound instead of inverting it.
 */
function normalisePoolBound(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

/**
 * Resolve the pool size, which has no "disabled" value.
 *
 * pg-pool does `max || poolSize || 10`, so `0` silently becomes 10 and a
 * negative `max` makes `_isFull()` true forever. A non-positive or non-finite
 * value is normalised to the documented default so the pool can still serve a
 * request.
 */
function normalisePoolSize(value: number): number {
  if (!Number.isFinite(value) || value < 1) return DB_MAX_CONNECTIONS_DEFAULT
  return Math.floor(value)
}

/**
 * Initialize database connection pool
 */
export function initializeDatabase(config: Partial<DatabaseConfig> = {}): Pool {
  if (pool) {
    return pool
  }

  // In production, refuse to silently fall back to localhost defaults when no
  // host was configured via DATABASE_URL, DB_HOST, or the caller's config.
  if (
    process.env['NODE_ENV'] === 'production' &&
    !process.env['DATABASE_URL'] &&
    !process.env['DB_HOST'] &&
    !config.host
  ) {
    throw new Error(
      'Database is not configured: set DATABASE_URL (or DB_HOST and related DB_* variables) in production.',
    )
  }

  lastConfig = config
  const finalConfig = { ...resolveDefaultConfig(), ...config }
  activeConfig = finalConfig
  const newPool = new Pool({
    ...finalConfig,
    // Server-enforced per-statement bound. Without it a stuck first statement
    // occupies the request until the route deadline fires. `0` disables it;
    // a non-positive value must be normalised before pg turns it into an
    // invalid startup parameter.
    statement_timeout: normalisePoolBound(finalConfig.statementTimeoutMillis),
    // Client-enforced per-statement bound. `statement_timeout` never reaches a
    // statement written to a socket the server is not reading, so a reused
    // pooled client whose peer has gone silent has no bound without this.
    // `0` is pg's "no timeout", so a non-positive override disables the bound;
    // a negative value must be normalised first, because pg's
    // `if (readTimeout)` is truthy for it and `setTimeout` would fire
    // immediately.
    query_timeout: normalisePoolBound(finalConfig.queryTimeoutMillis),
    // pg-pool's checkout timer is a truthiness test, so `0` disables it but a
    // negative value is truthy and schedules `setTimeout(…, -N)`, which fires
    // on the next turn and destroys every connecting or queued client. pg also
    // derives the libpq `connect_timeout` from this value, and PostgreSQL
    // rejects a negative one. Normalise non-positive to `0` (disabled).
    connectionTimeoutMillis: normalisePoolBound(
      finalConfig.connectionTimeoutMillis,
    ),
    // Same truthiness trap in pg-pool's idle timer: a negative value evicts
    // every client the moment it is released, so the pool reconnects per
    // query. Normalise non-positive to `0` (disabled).
    idleTimeoutMillis: normalisePoolBound(finalConfig.idleTimeoutMillis),
    // `max || poolSize || 10` turns `0` into 10 and a negative `max` into a
    // permanently full pool. Normalise non-positive to the documented default.
    max: normalisePoolSize(finalConfig.max),
    // Declarative keepalive on the socket. Node honours it; pg-cloudflare
    // implements setKeepAlive() as a no-op, so on the Worker this documents the
    // intent and the client-lifetime bound below is the mechanism that acts.
    keepAlive: finalConfig.keepAlive,
    keepAliveInitialDelayMillis: finalConfig.keepAliveInitialDelayMillis,
  })
  pool = newPool

  // Idle-client error: the server (or the runtime) dropped a pooled socket.
  // pg handles the broken client itself; what matters is that the pool does
  // not keep handing out stale sockets. Discard the pool so the next access
  // rebuilds it fresh. Do NOT process.exit() here: on Cloudflare Workers
  // that would tear down the whole isolate, and on a long-lived server it is
  // the wrong remedy for a recoverable network blip.
  newPool.on('error', (err: unknown) => {
    logger.error('Unexpected error on idle client; discarding the pool', err)
    if (pool === newPool) {
      pool = null
    }
    void discardPool(newPool)
  })

  // 'connect' is not in Pool's type definition but pool does emit it at runtime
  ;(newPool as unknown as PoolWithConnectEvent).on(
    'connect',
    (client: PoolClient) => {
      // Record the connection time so acquireClient can refuse to hand out a
      // client that has outlived the recycle bound.
      clientConnectedAt.set(client, Date.now())
      logger.info('New client connected to database')
    },
  )

  logger.info(
    `Database pool initialized for ${finalConfig.host}:${finalConfig.port}/${finalConfig.database} with ${finalConfig.max} max connections`,
  )
  return newPool
}

// Pools in the middle of being torn down. end() is safe to call once per
// instance; the guard keeps error floods from ending the same pool twice.
const closingPools = new WeakSet<Pool>()

function discardPool(stale: Pool): Promise<void> {
  if (closingPools.has(stale)) return Promise.resolve()
  closingPools.add(stale)
  return stale.end().catch(() => {
    // The pool is already gone or its clients are already dead; there is
    // nothing to clean up.
  })
}

/**
 * Discard `target` only if it is still the live pool. A concurrent request may
 * already have rebuilt it; tearing the replacement down would poison the pool
 * for everyone else.
 */
function invalidatePoolIfCurrent(target: Pool): void {
  if (pool !== target) return
  pool = null
  void discardPool(target)
}

/**
 * Error codes that indicate the *connection* failed or dropped, not the
 * statement. Safe to retry by rebuilding the pool: OS-level socket codes,
 * PostgreSQL class 08 (connection_exception), 57 (server_cannot_connect),
 * and 58 (system_error).
 */
const TRANSIENT_CONNECTION_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'ENOTFOUND',
  'EPROTO',
  'EBADF',
  '08000',
  '08003',
  '08006',
  '57P01',
  '57P02',
  '57P03',
  '58000',
  '58001',
  '58002',
])

const TRANSIENT_CONNECTION_MESSAGES = [
  'connection timeout expired',
  'timeout exceeded when trying to connect',
  'connection terminated unexpectedly',
  'the server closed the connection unexpectedly',
  'could not connect to server',
  'the database system is shutting down',
  'network connection lost',
  'bad file descriptor',
  'ssl has not been negotiated',
]

function isTransientConnectionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const err = error as { code?: unknown; message?: unknown }
  if (
    typeof err.code === 'string' &&
    TRANSIENT_CONNECTION_CODES.has(err.code)
  ) {
    return true
  }
  const message =
    typeof err.message === 'string' ? err.message.toLowerCase() : ''
  return TRANSIENT_CONNECTION_MESSAGES.some((needle) =>
    message.includes(needle),
  )
}

/**
 * Get database connection pool, creating it on demand.
 *
 * Callers may reach this without startup having run initializeDatabase
 * (SSR pages, or a Workers request after the pool was discarded following a
 * connection failure). Creating lazily is what makes the pool self-healing:
 * the previous instance is already torn down, and a fresh one with new
 * sockets is returned.
 */
export function getPool(): Pool {
  if (!pool) {
    return initializeDatabase(lastConfig)
  }
  return pool
}

/**
 * A connection-level failure the caller may retry: the acquisition bound
 * expired, or the pool raised a transient connection error on every attempt.
 *
 * Routes map this to their retryable `503` + `Retry-After` shape instead of a
 * `500`, because the database may be reachable on the next request.
 */
export class DatabaseUnavailableError extends Error {
  readonly code = 'DB_UNAVAILABLE'

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'DatabaseUnavailableError'
    if (cause !== undefined) this.cause = cause
  }
}

/**
 * True when `error` is a retryable database-availability failure.
 *
 * Covers the acquisition timeout (`DatabaseUnavailableError`), a statement
 * abandoned by the client-side query bound (this module's own deadline or pg's
 * `query_timeout`), and a transient connection error raised by pg on the final
 * attempt, so all of them surface as the same retryable status.
 */
export function isDatabaseUnavailableError(error: unknown): boolean {
  if (error instanceof DatabaseUnavailableError) return true
  if (isQueryTimeoutError(error)) return true
  const carriesCode =
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'DB_UNAVAILABLE'
  return carriesCode || isTransientConnectionError(error)
}

/** Raised internally when one acquisition attempt exceeds its bound. */
class AcquireTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Database client acquisition exceeded its ${timeoutMs}ms bound`)
    this.name = 'AcquireTimeoutError'
  }
}

/**
 * Bound one `pool.connect()` call.
 *
 * A client that arrives *after* the bound is destroyed rather than released:
 * the pool has already been discarded, and returning it would leave a
 * checked-out slot that nothing ever releases — the leak that poisons the pool
 * for later requests.
 */
function acquireWithDeadline(
  pool: Pool,
  timeoutMs: number,
): Promise<PoolClient> {
  // A non-positive bound disables the deadline, matching pg's own
  // `connectionTimeoutMillis` and the liveness-probe, client-lifetime and
  // statement guards. Without this guard `setTimeout(…, 0)` fires before
  // `connect()` can settle, so `DB_ACQUIRE_TIMEOUT=0` made every acquisition
  // fail immediately instead of disabling the bound.
  if (timeoutMs <= 0) return pool.connect()
  const attempt = pool.connect()
  let timedOut = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true
      reject(new AcquireTimeoutError(timeoutMs))
    }, timeoutMs)
  })
  // Attach a handler to the attempt itself so a late rejection is never an
  // unhandled rejection once the race has already settled.
  attempt.then(
    (client) => {
      if (timedOut) client.release(true)
    },
    () => undefined,
  )
  return Promise.race([attempt, deadline]).finally(() => {
    if (timer !== undefined) clearTimeout(timer)
  })
}

function resolveAcquireTimeoutMs(): number {
  return (
    activeConfig?.acquireTimeoutMillis ??
    lastConfig.acquireTimeoutMillis ??
    DB_ACQUIRE_TIMEOUT_MS
  )
}

function resolveQueryTimeoutMs(): number {
  return (
    activeConfig?.queryTimeoutMillis ??
    lastConfig.queryTimeoutMillis ??
    DB_QUERY_TIMEOUT_MS
  )
}

function resolveMaxLifetimeMs(): number {
  const seconds =
    activeConfig?.clientLifetimeSeconds ??
    lastConfig.clientLifetimeSeconds ??
    DB_MAX_LIFETIME_SECONDS
  return seconds * 1000
}

function resolveLivenessProbeTimeoutMs(): number {
  return (
    activeConfig?.livenessProbeTimeoutMillis ??
    lastConfig.livenessProbeTimeoutMillis ??
    DB_LIVENESS_PROBE_TIMEOUT_MS
  )
}

/**
 * True when `client` has outlived the recycle bound.
 *
 * Clients created before the pool registered its `connect` listener (and any
 * fake in a test) have no recorded age and are treated as fresh.
 */
function isClientPastLifetime(client: PoolClient): boolean {
  const maxLifetimeMs = resolveMaxLifetimeMs()
  if (maxLifetimeMs <= 0) return false
  const connectedAt = clientConnectedAt.get(client)
  if (connectedAt === undefined) return false
  return Date.now() - connectedAt >= maxLifetimeMs
}

/**
 * Check out a client, replacing one that has outlived the recycle bound.
 *
 * A client older than `clientLifetimeSeconds` may already have been closed by
 * the peer while the isolate was frozen; handing it to a statement is exactly
 * the silent hang this module now bounds. Destroy it and take the next one. The
 * loop is capped at the pool's own client count, so a pool full of stale
 * sockets drains in one pass and the next client pg creates is fresh.
 */
async function checkoutClient(
  pool: Pool,
  timeoutMs: number,
): Promise<PoolClient> {
  let client = await acquireWithDeadline(pool, timeoutMs)
  for (
    let recycled = 0;
    recycled < DB_CLIENT_RECYCLE_LIMIT && isClientPastLifetime(client);
    recycled++
  ) {
    logger.info('Recycling a pooled database client past its lifetime bound')
    client.release(true)
    client = await acquireWithDeadline(pool, timeoutMs)
  }
  return client
}

/**
 * Prove a borrowed client answers before a caller issues a statement on it.
 *
 * `SELECT 1` on the client itself, bounded by the probe's own short deadline,
 * so a socket the peer closed while the isolate was idle fails fast instead of
 * waiting for `DB_QUERY_TIMEOUT_MS`. A raised error and a timeout are the same
 * verdict here: the client must not be handed out.
 *
 * The probe statement is deliberately not passed through `recordQuery`: it is
 * this module's health check, not a caller query, and counting it would skew
 * the query metrics for every request.
 */
async function probeClientLiveness(
  client: PoolClient,
  timeoutMs: number,
): Promise<boolean> {
  if (timeoutMs <= 0) return true
  try {
    await queryWithDeadline(
      client,
      DB_LIVENESS_PROBE_STATEMENT,
      undefined,
      timeoutMs,
    )
    return true
  } catch {
    return false
  }
}

/**
 * Acquire a client, bounded and rebuilt-once.
 *
 * Every attempt is bounded by `acquireTimeoutMillis`, so a `connect()` that
 * never settles fails fast instead of stalling until the request deadline. A
 * timed-out or transiently failed attempt discards the pool (which may be
 * holding a half-open socket, or a slot nobody will release) and retries once
 * on a fresh one. If both attempts fail, the failure is either the original
 * raised error or a `DatabaseUnavailableError` for a pure timeout.
 *
 * A client the pool has handed out before is probed before it is returned: a
 * reused socket may already be dead, and the caller must not be the one to
 * discover that with its own statement. A failed probe destroys that client and
 * takes a replacement, so the caller only ever sees a client that answered. The
 * probe is skipped for a client the pool just created — a successful connect is
 * its own proof of liveness, and a healthy acquire must not pay a round trip it
 * does not need.
 *
 * The success path logs whether the client was new or reused, so a future tail
 * can tell a queued `connect()` from a hung statement on a pooled client. A
 * probe trip logs its own line, distinct from the recycle and from the acquire
 * line, so the two can be counted separately.
 *
 * Routes that manage their own multi-statement or transactional work against
 * pg directly should acquire clients through this instead of
 * `getPool().connect()`, so a stale socket self-heals instead of 500-ing the
 * request.
 */
export async function acquireClient(): Promise<PoolClient> {
  const timeoutMs = resolveAcquireTimeoutMs()
  const probeTimeoutMs = resolveLivenessProbeTimeoutMs()
  let lastError: unknown

  for (let attempt = 1; attempt <= DB_ACQUIRE_ATTEMPTS; attempt++) {
    const activePool = getPool()
    try {
      let client = await checkoutClient(activePool, timeoutMs)
      for (let trips = 0; checkedOutClients.has(client); trips++) {
        if (await probeClientLiveness(client, probeTimeoutMs)) break
        client.release(true)
        if (trips + 1 >= DB_LIVENESS_PROBE_TRIPS) {
          // The pool keeps handing out sockets that cannot answer. Discard it
          // so the next request starts from a fresh set, and give this caller
          // the retryable failure the routes already map to a 503.
          invalidatePoolIfCurrent(activePool)
          throw new DatabaseUnavailableError(
            `Pooled database clients failed their ${probeTimeoutMs}ms liveness probe (${DB_LIVENESS_PROBE_TRIPS} attempts)`,
          )
        }
        client = await checkoutClient(activePool, timeoutMs)
        logger.warn(
          `Pooled database client failed its liveness probe (${probeTimeoutMs}ms bound); destroyed it and acquired a replacement`,
        )
      }
      const isNew = !checkedOutClients.has(client)
      checkedOutClients.add(client)
      logger.info(`Acquired database client: ${isNew ? 'new' : 'reused'}`)
      return client
    } catch (error: unknown) {
      lastError = error
      const timedOut = error instanceof AcquireTimeoutError
      if (!timedOut && !isTransientConnectionError(error)) throw error
      invalidatePoolIfCurrent(activePool)
      if (attempt < DB_ACQUIRE_ATTEMPTS) {
        logger.warn(
          'Failed to acquire a database connection; rebuilding the pool and retrying once',
          error,
        )
      }
    }
  }

  if (lastError instanceof AcquireTimeoutError) {
    throw new DatabaseUnavailableError(
      `Database connection could not be acquired within ${timeoutMs}ms per attempt (${DB_ACQUIRE_ATTEMPTS} attempts)`,
      lastError,
    )
  }
  throw lastError
}

/** Raised internally when one statement exceeds its client-side bound. */
class QueryTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Database statement exceeded its ${timeoutMs}ms bound`)
    this.name = 'QueryTimeoutError'
  }
}

/**
 * True when a statement was abandoned by the client-side bound: either this
 * module's own deadline or pg's `query_timeout` (message `Query read timeout`)
 * for a statement a caller issued directly on the client.
 */
function isQueryTimeoutError(error: unknown): boolean {
  if (error instanceof QueryTimeoutError) return true
  if (!error || typeof error !== 'object') return false
  const message =
    typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message.toLowerCase()
      : ''
  return message.includes('query read timeout')
}

/**
 * True when the client must be destroyed rather than returned to the pool.
 *
 * A timed-out statement leaves a half-consumed protocol stream behind, and a
 * connection-level failure has already lost the socket. Releasing either one
 * back to the idle list is how a poisoned client gets handed to the next
 * request.
 */
function isUnusableClientError(error: unknown): boolean {
  return isQueryTimeoutError(error) || isTransientConnectionError(error)
}

/**
 * Bound one statement on `client`.
 *
 * pg's `query_timeout` is the pool-level bound that covers every caller; this
 * race enforces the same bound for the statements this module issues, so the
 * limit holds even when pg's timer never fires. A late rejection after the
 * race has settled is swallowed so it can never become an unhandled rejection.
 */
function queryWithDeadline<T>(
  client: PoolClient,
  text: string,
  params: unknown[] | undefined,
  timeoutMs: number,
): Promise<T> {
  const attempt = client.query<T>(text, params) as unknown as Promise<T>
  // A non-positive bound disables the deadline, matching pg's `query_timeout`
  // and the liveness-probe and client-lifetime guards. Without this guard
  // `setTimeout(…, 0)` fires before any statement can settle, so
  // `DB_QUERY_TIMEOUT=0` made every query fail immediately instead of
  // disabling the bound.
  if (timeoutMs <= 0) return attempt
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new QueryTimeoutError(timeoutMs)),
      timeoutMs,
    )
  })
  attempt.catch(() => undefined)
  return Promise.race([attempt, deadline]).finally(() => {
    if (timer !== undefined) clearTimeout(timer)
  })
}

/** Map a statement failure onto the retryable availability error. */
function toDatabaseUnavailable(error: unknown, timeoutMs: number): unknown {
  if (error instanceof DatabaseUnavailableError) return error
  if (isQueryTimeoutError(error)) {
    return new DatabaseUnavailableError(
      `Database statement could not complete within ${timeoutMs}ms`,
      error,
    )
  }
  return error
}

/**
 * Execute a query with automatic connection management
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<DbQueryResult<T>> {
  recordQuery(text)
  const timeoutMs = resolveQueryTimeoutMs()
  const client = await acquireClient()
  let destroy = false
  try {
    return await queryWithDeadline<DbQueryResult<T>>(
      client,
      text,
      params,
      timeoutMs,
    )
  } catch (error: unknown) {
    destroy = isUnusableClientError(error)
    throw toDatabaseUnavailable(error, timeoutMs)
  } finally {
    if (destroy) client.release(true)
    else client.release()
  }
}

/**
 * Execute a transaction with automatic rollback on error
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const timeoutMs = resolveQueryTimeoutMs()
  const client = await acquireClient()
  let destroy = false
  try {
    recordQuery('BEGIN')
    await queryWithDeadline(client, 'BEGIN', undefined, timeoutMs)
    const result = await callback(client)
    recordQuery('COMMIT')
    await queryWithDeadline(client, 'COMMIT', undefined, timeoutMs)
    return result
  } catch (error: unknown) {
    // A dead or timed-out connection has already lost its server-side state,
    // and a ROLLBACK on it would just wait for the same bound again. Destroy
    // it instead; do not let a failed ROLLBACK mask the original error.
    destroy = isUnusableClientError(error)
    if (!destroy) {
      await client.query('ROLLBACK').catch(() => undefined)
    }
    throw toDatabaseUnavailable(error, timeoutMs)
  } finally {
    if (destroy) client.release(true)
    else client.release()
  }
}

/**
 * Health check for database connection
 */
export async function closeDatabase(): Promise<void> {
  const stale = pool
  pool = null
  if (stale) {
    await discardPool(stale)
    logger.info('Database connection pool closed')
  }
}

/**
 * Create content hash for caching bias analysis results
 */
export function createContentHash(
  content: string,
  demographics: {
    age?: unknown
    gender?: unknown
    ethnicity?: unknown
    primaryLanguage?: unknown
  },
): string {
  const hashInput = JSON.stringify({
    content: content.trim().toLowerCase(),
    demographics: {
      age: demographics.age,
      gender: demographics.gender,
      ethnicity: demographics.ethnicity,
      primaryLanguage: demographics.primaryLanguage,
    },
  })
  return createHash('sha256').update(hashInput).digest('hex')
}

/** Result from running migrations from a directory. */
interface MigrateFromDirectoryResult {
  applied: string[]
  skipped: string[]
}

/** Result from rolling back the last migration. */
interface RollbackLastResult {
  rolledBack: string | null
}

/** Status of applied vs pending migrations. */
interface MigrationStatusResult {
  applied: string[]
  pending: string[]
}

/**
 * Database migration utilities
 */
export class DatabaseMigration {
  private readonly migrations: Map<string, string> = new Map()

  /**
   * Register a migration
   */
  register(name: string, sql: string): void {
    this.migrations.set(name, sql)
  }

  /**
   * Run all registered migrations
   */
  async runMigrations(): Promise<void> {
    for (const [name, sql] of this.migrations) {
      logger.info(`Running migration: ${name}`)
      try {
        await query(sql)
        logger.info(`✅ Migration ${name} completed`)
      } catch (error: unknown) {
        logger.error(`❌ Migration ${name} failed:`, error)
        throw error
      }
    }
  }

  /**
   * Check if the migrations table exists and create if needed.
   *
   * Some databases predate this runner and carry a schema_migrations table
   * with a foreign shape (version integer PRIMARY KEY, applied_at text)
   * recorded by earlier tooling. Those version numbers are bookkeeping from a
   * different migration system and cannot be trusted to match this repo's
   * NNN_*.sql files — drift has been observed (recorded versions whose tables
   * never existed). The legacy table is therefore preserved as
   * schema_migrations_legacy for history and a fresh app-shaped tracking
   * table is created, so every migration file is (re)applied and recorded
   * from the repo's own history instead of being skipped on bad bookkeeping.
   */
  async ensureMigrationsTable(): Promise<void> {
    await query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT NOW()
      )
    `)

    const columns = await this.getSchemaMigrationsColumns()
    if (!columns.includes('version')) return
    // Legacy shape detected: preserve it and start a fresh tracking table. A
    // pre-existing schema_migrations_legacy is unreachable here (after the
    // first successful run schema_migrations is app-shaped and never carries
    // a version column again), so a failed RENAME fails loudly rather than
    // silently mis-tracking.
    await query(
      'ALTER TABLE schema_migrations RENAME TO schema_migrations_legacy',
    )
    await query(`
      CREATE TABLE schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT NOW()
      )
    `)
  }

  /**
   * Get list of executed migrations
   */
  async getExecutedMigrations(): Promise<string[]> {
    const result = await query<{ name: string }>(
      'SELECT name FROM schema_migrations ORDER BY executed_at',
    )
    return result.rows.map((row: { name: string }) => row.name)
  }

  /**
   * Mark migration as executed
   */
  async markMigrationExecuted(name: string): Promise<void> {
    await query('INSERT INTO schema_migrations (name) VALUES ($1)', [name])
  }

  /**
   * Run all pending migrations from a directory of NNN_*.sql files.
   * Skips any migration whose filename is already in schema_migrations.
   * Returns the names of migrations that were applied and skipped.
   */
  async runMigrationsFromDirectory(
    dir: string,
    fsAdapter: Pick<
      typeof import('node:fs/promises'),
      'readdir' | 'readFile'
    > = {
      readdir,
      readFile,
    },
  ): Promise<{ applied: string[]; skipped: string[] }> {
    await this.ensureMigrationsTable()
    const executed = new Set(await this.getExecutedMigrations())
    const files = await this.listMigrationFiles(dir, fsAdapter)
    const applied: string[] = []
    const skipped: string[] = []

    for (const { name, sql } of files) {
      if (executed.has(name)) {
        skipped.push(name)
        continue
      }
      await query(sql)
      await this.markMigrationExecuted(name)
      applied.push(name)
    }

    return { applied, skipped }
  }

  /**
   * Roll back the most recently applied migration that has a paired
   * .rollback.sql file. Returns the rolled-back name, or null if no
   * rollback was performed (no applied migrations, or none have rollback files).
   */
  async rollbackLast(
    dir: string,
    fsAdapter: Pick<
      typeof import('node:fs/promises'),
      'readdir' | 'readFile'
    > = {
      readdir,
      readFile,
    },
  ): Promise<{ rolledBack: string | null }> {
    await this.ensureMigrationsTable()
    const executed = await this.getExecutedMigrations()

    for (let i = executed.length - 1; i >= 0; i--) {
      const name = executed[i]
      if (name === undefined) continue
      const rollbackSql = await this.readRollbackFile(dir, name, fsAdapter)
      if (rollbackSql !== null) {
        await query(rollbackSql)
        await query('DELETE FROM schema_migrations WHERE name = $1', [name])
        return { rolledBack: name }
      }
    }
    return { rolledBack: null }
  }

  /**
   * Report which migrations from the directory are applied vs pending.
   * Files in the directory are sorted by name; a migration is "applied"
   * if its filename is recorded in schema_migrations.
   */
  async getStatus(
    dir: string,
    fsAdapter: Pick<
      typeof import('node:fs/promises'),
      'readdir' | 'readFile'
    > = {
      readdir,
      readFile,
    },
  ): Promise<{ applied: string[]; pending: string[] }> {
    await this.ensureMigrationsTable()
    const executed = new Set(await this.getExecutedMigrations())
    const files = await this.listMigrationFiles(dir, fsAdapter)
    const applied: string[] = []
    const pending: string[] = []
    for (const { name } of files) {
      if (executed.has(name)) applied.push(name)
      else pending.push(name)
    }
    return { applied, pending }
  }

  /**
   * List the actual columns of schema_migrations (empty when the table does
   * not exist yet).
   */
  private async getSchemaMigrationsColumns(): Promise<string[]> {
    const result = await query<{ column_name: string }>(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_name = 'schema_migrations'`,
    )
    return result.rows.map((row: { column_name: string }) => row.column_name)
  }

  private async listMigrationFiles(
    dir: string,
    fsAdapter: Pick<typeof import('node:fs/promises'), 'readdir' | 'readFile'>,
  ): Promise<Array<{ name: string; sql: string }>> {
    const entries = await fsAdapter.readdir(dir)
    const sqlFiles = entries
      .filter((f) => /^\d{3}_.+\.sql$/.test(f))
      .filter((f) => !f.endsWith('.rollback.sql'))
      .sort()
    const out: Array<{ name: string; sql: string }> = []
    for (const file of sqlFiles) {
      const sql = await fsAdapter.readFile(path.join(dir, file), 'utf8')
      out.push({ name: file, sql })
    }
    return out
  }

  private async readRollbackFile(
    dir: string,
    migrationName: string,
    fsAdapter: Pick<typeof import('node:fs/promises'), 'readdir' | 'readFile'>,
  ): Promise<string | null> {
    const rollbackName = migrationName.replace(/\.sql$/, '.rollback.sql')
    const rollbackPath = path.join(dir, rollbackName)
    try {
      return await fsAdapter.readFile(rollbackPath, 'utf8')
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw err
    }
  }
}

// Global migration instance
export const migrations = new DatabaseMigration()

/**
 * Resolve the workspace a newly created user belongs to.
 *
 * `users.workspace_id` is `NOT NULL` with no default (migration 011), so every
 * insert must name it. The seeded `personal` workspace is the platform's
 * existing default for a user with no organisation assignment; when it is
 * absent, creating the user is refused explicitly instead of writing a row the
 * constraint rejects. This is the same resolution `createUserWithLink()` in
 * `lib/auth/user-identity.ts` performs, sharing its slug.
 */
async function resolveDefaultWorkspaceId(): Promise<string> {
  const result = await query<{ id: string }>(
    `SELECT id FROM workspaces WHERE slug = $1 LIMIT 1`,
    [DEFAULT_WORKSPACE_SLUG],
  )
  const workspaceId = result.rows[0]?.id
  if (!workspaceId) {
    throw new WorkspaceResolutionError(
      `Cannot provision user: no '${DEFAULT_WORKSPACE_SLUG}' workspace exists to assign`,
    )
  }
  return workspaceId
}

/**
 * User management utilities
 */
class UserManager {
  /**
   * Create a new user
   */
  async createUser(userData: {
    email: string
    passwordHash: string
    firstName: string
    lastName: string
    role?: string
    institution?: string
    licenseNumber?: string
  }): Promise<string> {
    const workspaceId = await resolveDefaultWorkspaceId()

    const result = await query(
      `
      INSERT INTO users (
        email, password_hash, first_name, last_name,
        role, institution, license_number, workspace_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `,
      [
        userData.email,
        userData.passwordHash,
        userData.firstName,
        userData.lastName,
        userData.role ?? 'therapist',
        userData.institution,
        userData.licenseNumber,
        workspaceId,
      ],
    )

    return (result.rows[0] as { id: string }).id
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<any> {
    const result = await query(
      `
      SELECT u.*, up.*
      FROM users u
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE u.id = $1 AND u.is_active = true
    `,
      [id],
    )

    return result.rows[0] ?? null
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<any> {
    const result = await query(
      `
      SELECT u.*, up.*
      FROM users u
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE u.email = $1 AND u.is_active = true
    `,
      [email],
    )

    return result.rows[0] ?? null
  }

  /**
   * Update user profile
   */
  async updateUserProfile(
    userId: string,
    profileData: {
      bio?: string
      specializations?: string[]
      years_experience?: number
      certifications?: string[]
      languages?: string[]
      timezone?: string
    },
  ): Promise<void> {
    await query(
      `
      INSERT INTO user_profiles (
        user_id, bio, specializations, years_experience,
        certifications, languages, timezone
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id)
      DO UPDATE SET
        bio = EXCLUDED.bio,
        specializations = EXCLUDED.specializations,
        years_experience = EXCLUDED.years_experience,
        certifications = EXCLUDED.certifications,
        languages = EXCLUDED.languages,
        timezone = EXCLUDED.timezone,
        updated_at = NOW()
    `,
      [
        userId,
        profileData.bio,
        profileData.specializations,
        profileData.years_experience,
        profileData.certifications,
        profileData.languages ?? ['en'],
        profileData.timezone ?? 'UTC',
      ],
    )
  }
}

/**
 * Session management utilities
 */
class SessionManager {
  /**
   * Create a new therapy session
   */
  async createSession(sessionData: {
    therapistId: string
    clientId?: string
    sessionType?: string
    context?: Record<string, unknown>
  }): Promise<string> {
    const result = await query(
      `
      INSERT INTO sessions (
        therapist_id, client_id, session_type, context, started_at
      )
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id
    `,
      [
        sessionData.therapistId,
        sessionData.clientId,
        sessionData.sessionType ?? 'individual',
        JSON.stringify(sessionData.context ?? {}),
      ],
    )

    return (result.rows[0] as { id: string }).id
  }

  /**
   * End a session
   */
  async endSession(sessionId: string, summary?: string): Promise<void> {
    await query(
      `
      UPDATE sessions
      SET state = 'completed', ended_at = NOW(), summary = $2
      WHERE id = $1
    `,
      [sessionId, summary],
    )
  }

  /**
   * Get session by ID
   */
  async getSessionById(sessionId: string): Promise<any> {
    const result = await query(
      `
      SELECT s.*, u.first_name, u.last_name
      FROM sessions s
      JOIN users u ON s.therapist_id = u.id
      WHERE s.id = $1
    `,
      [sessionId],
    )

    return result.rows[0] ?? null
  }

  /**
   * Get sessions for a therapist
   */
  async getSessionsForTherapist(
    therapistId: string,
    limit: number = 50,
  ): Promise<any[]> {
    const result = await query(
      `
      SELECT s.*, u.first_name, u.last_name
      FROM sessions s
      JOIN users u ON s.therapist_id = u.id
      WHERE s.therapist_id = $1
      ORDER BY s.started_at DESC
      LIMIT $2
    `,
      [therapistId, limit],
    )

    return result.rows
  }
}

/**
 * Bias analysis management utilities
 */
class BiasAnalysisManager {
  /**
   * Save bias analysis result
   */
  async saveAnalysis(analysisData: {
    sessionId: string
    therapistId: string
    overallBiasScore: number
    alertLevel: string
    confidence: number
    layerResults: Record<string, unknown>
    detectedBiases: string[]
    recommendations: string[]
    demographics: Record<string, unknown>
    contentHash: string
    processingTimeMs: number
  }): Promise<string> {
    const result = await query(
      `
      INSERT INTO bias_analyses (
        session_id, therapist_id, overall_bias_score, alert_level,
        confidence, layer_results, detected_biases, recommendations, demographics,
        content_hash, processing_time_ms
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `,
      [
        analysisData.sessionId,
        analysisData.therapistId,
        analysisData.overallBiasScore,
        analysisData.alertLevel,
        analysisData.confidence,
        JSON.stringify(analysisData.layerResults),
        analysisData.detectedBiases,
        analysisData.recommendations,
        JSON.stringify(analysisData.demographics),
        analysisData.contentHash,
        analysisData.processingTimeMs,
      ],
    )

    return (result.rows[0] as { id: string }).id
  }

  /**
   * Get cached analysis by content hash
   */
  async getCachedAnalysis(contentHash: string): Promise<any> {
    const result = await query(
      `
      SELECT
        id,
        session_id          AS "sessionId",
        therapist_id        AS "therapistId",
        overall_bias_score  AS "overallBiasScore",
        alert_level         AS "alertLevel",
        confidence,
        layer_results       AS "layerResults",
        detected_biases     AS "detectedBiases",
        recommendations,
        demographics,
        content_hash        AS "contentHash",
        processing_time_ms  AS "processingTimeMs",
        created_at          AS "createdAt"
      FROM bias_analyses
      WHERE content_hash = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
      [contentHash],
    )

    return result.rows[0] ?? null
  }

  /**
   * Get analyses for a therapist
   */
  async getAnalysesForTherapist(
    therapistId: string,
    limit: number = 100,
  ): Promise<any[]> {
    const result = await query(
      `
      SELECT
        ba.id,
        ba.session_id        AS "sessionId",
        ba.therapist_id      AS "therapistId",
        ba.overall_bias_score AS "overallBiasScore",
        ba.alert_level       AS "alertLevel",
        ba.confidence,
        ba.layer_results     AS "layerResults",
        ba.detected_biases   AS "detectedBiases",
        ba.recommendations,
        ba.demographics,
        ba.content_hash      AS "contentHash",
        ba.processing_time_ms AS "processingTimeMs",
        ba.created_at        AS "createdAt",
        s.started_at         AS "sessionDate"
      FROM bias_analyses ba
      JOIN sessions s ON ba.session_id = s.id
      WHERE ba.therapist_id = $1
      ORDER BY ba.created_at DESC
      LIMIT $2
    `,
      [therapistId, limit],
    )

    return result.rows
  }

  /**
   * Get bias analysis summary for therapist
   */
  async getBiasSummary(therapistId: string, days: number = 30): Promise<any> {
    const result = await query(
      `
      SELECT
        COUNT(*) as total_analyses,
        ROUND(AVG(overall_bias_score)::numeric, 3) as avg_bias_score,
        COUNT(CASE WHEN alert_level IN ('high', 'critical') THEN 1 END) as high_alerts,
        COUNT(CASE WHEN alert_level = 'low' THEN 1 END) as low_alerts,
        MAX(created_at) as last_analysis
      FROM bias_analyses
      WHERE therapist_id = $1
        AND created_at >= NOW() - make_interval(days => $2::int)
    `,
      [therapistId, days],
    )

    return (
      result.rows[0] ?? {
        total_analyses: 0,
        avg_bias_score: 0,
        high_alerts: 0,
        low_alerts: 0,
        last_analysis: null,
      }
    )
  }
}

// Export utility instances
export const userManager = new UserManager()
export const sessionManager = new SessionManager()
export const biasAnalysisManager = new BiasAnalysisManager()

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, closing database connections...')
  await closeDatabase()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, closing database connections...')
  await closeDatabase()
  process.exit(0)
})
