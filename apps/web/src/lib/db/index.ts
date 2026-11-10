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
 * Override with `DB_STATEMENT_TIMEOUT`; `0` disables it for long maintenance
 * statements.
 */
export const DB_STATEMENT_TIMEOUT_MS = 5_000

/**
 * Upper bound on one pool connect/checkout (`connectionTimeoutMillis`). It also
 * bounds callers that use `getPool().query()` directly, which bypass
 * `acquireClient`. Override with `DB_CONNECTION_TIMEOUT`.
 */
export const DB_CONNECTION_TIMEOUT_MS = 3_000

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
  if (env['DB_PORT']) fromEnv.port = parseInt(env['DB_PORT'], 10)
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

  const isLocalHost = (host?: string) =>
    !host || host === 'localhost' || host === '127.0.0.1' || host === '::1'
  const effectiveHost: string | undefined = fromEnv.host ?? fromUrl.host

  return {
    host: 'localhost',
    port: 5432,
    database: 'pixelated',
    user: 'postgres',
    password: '',
    max: envInt('DB_MAX_CONNECTIONS', 20),
    idleTimeoutMillis: envInt('DB_IDLE_TIMEOUT', 30000),
    connectionTimeoutMillis: envInt(
      'DB_CONNECTION_TIMEOUT',
      DB_CONNECTION_TIMEOUT_MS,
    ),
    acquireTimeoutMillis: envInt('DB_ACQUIRE_TIMEOUT', DB_ACQUIRE_TIMEOUT_MS),
    statementTimeoutMillis: envInt(
      'DB_STATEMENT_TIMEOUT',
      DB_STATEMENT_TIMEOUT_MS,
    ),
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
    // occupies the request until the route deadline fires.
    statement_timeout: finalConfig.statementTimeoutMillis,
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
    (_client: PoolClient) => {
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
 * Covers the acquisition timeout (`DatabaseUnavailableError`) and a transient
 * connection error raised by pg on the final attempt, so both surface as the
 * same retryable status.
 */
export function isDatabaseUnavailableError(error: unknown): boolean {
  if (error instanceof DatabaseUnavailableError) return true
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
 * Routes that manage their own multi-statement or transactional work against
 * pg directly should acquire clients through this instead of
 * `getPool().connect()`, so a stale socket self-heals instead of 500-ing the
 * request.
 */
export async function acquireClient(): Promise<PoolClient> {
  const timeoutMs = resolveAcquireTimeoutMs()
  let lastError: unknown

  for (let attempt = 1; attempt <= DB_ACQUIRE_ATTEMPTS; attempt++) {
    const activePool = getPool()
    try {
      return await acquireWithDeadline(activePool, timeoutMs)
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

/**
 * Execute a query with automatic connection management
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<DbQueryResult<T>> {
  recordQuery(text)
  const client = await acquireClient()
  try {
    return (await client.query<T>(text, params)) as unknown as DbQueryResult<T>
  } finally {
    client.release()
  }
}

/**
 * Execute a transaction with automatic rollback on error
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await acquireClient()
  try {
    recordQuery('BEGIN')
    await client.query('BEGIN')
    const result = await callback(client)
    recordQuery('COMMIT')
    await client.query('COMMIT')
    return result
  } catch (error: unknown) {
    // A dead connection has already rolled back server-side; do not let a
    // failed ROLLBACK mask the original error.
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
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
    const result = await query(
      `
      INSERT INTO users (
        email, password_hash, first_name, last_name,
        role, institution, license_number
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
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
