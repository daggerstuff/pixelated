/**
 * Database connection and utility functions for Pixelated
 * Supports PostgreSQL with connection pooling and migration management
 */

import { createHash } from 'crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { Pool, PoolClient } from 'pg'

import { createBuildSafeLogger } from '../logging/build-safe-logger'
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

interface PoolStats {
  totalCount: number
  idleCount: number
  waitingCount: number
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
  ssl?: boolean | object
}

// Default configuration
const DEFAULT_CONFIG: DatabaseConfig = {
  host: process.env['DB_HOST'] ?? 'localhost',
  port: parseInt(process.env['DB_PORT'] ?? '5432'),
  database: process.env['DB_NAME'] ?? 'pixelated',
  user: process.env['DB_USER'] ?? 'postgres',
  password: process.env['DB_PASSWORD'] ?? '',
  max: parseInt(process.env['DB_MAX_CONNECTIONS'] ?? '20'),
  idleTimeoutMillis: parseInt(process.env['DB_IDLE_TIMEOUT'] ?? '30000'),
  connectionTimeoutMillis: parseInt(
    process.env['DB_CONNECTION_TIMEOUT'] ?? '2000',
  ),
  ssl: process.env['NODE_ENV'] === 'production',
}

// Connection pool
let pool: Pool | null = null

/**
 * Initialize database connection pool
 */
export function initializeDatabase(config: Partial<DatabaseConfig> = {}): Pool {
  if (pool) {
    return pool
  }

  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  pool = new Pool(finalConfig)

  // Handle pool errors
  pool.on('error', (err: unknown) => {
    logger.error('Unexpected error on idle client', err)
    void process.exit(-1)
  })

  // 'connect' is not in Pool's type definition but pool does emit it at runtime
  ;(pool as unknown as PoolWithConnectEvent).on(
    'connect',
    (_client: PoolClient) => {
      logger.info('New client connected to database')
    },
  )

  logger.info(
    `Database pool initialized with ${finalConfig.max} max connections`,
  )
  return pool
}

/**
 * Get database connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    throw new Error(
      'Database not initialized. Call initializeDatabase() first.',
    )
  }
  return pool
}

/**
 * Execute a query with automatic connection management
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<DbQueryResult<T>> {
  const client = await getPool().connect()
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
  // Ensure the pool is initialised before acquiring a connection.
  initializeDatabase()
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error: unknown) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Health check for database connection
 */
export async function healthCheck(): Promise<{
  status: 'healthy' | 'unhealthy'
  latency: number
  connections: {
    total: number
    idle: number
    waiting: number
  }
}> {
  const startTime = Date.now()
  try {
    await query('SELECT 1')
    const latency = Date.now() - startTime

    const poolState = getPool()
    return {
      status: 'healthy',
      latency,
      connections: {
        total: (poolState as unknown as PoolStats).totalCount,
        idle: (poolState as unknown as PoolStats).idleCount,
        waiting: (poolState as unknown as PoolStats).waitingCount,
      },
    }
  } catch {
    return {
      status: 'unhealthy',
      latency: Date.now() - startTime,
      connections: {
        total: 0,
        idle: 0,
        waiting: 0,
      },
    }
  }
}

/**
 * Close database connection pool
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
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
export interface MigrateFromDirectoryResult {
  applied: string[]
  skipped: string[]
}

/** Result from rolling back the last migration. */
export interface RollbackLastResult {
  rolledBack: string | null
}

/** Status of applied vs pending migrations. */
export interface MigrationStatusResult {
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
export class UserManager {
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
export class SessionManager {
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
export class BiasAnalysisManager {
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
