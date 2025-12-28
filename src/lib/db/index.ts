/**
 * Database connection and utility functions for Pixelated
 * Supports PostgreSQL with connection pooling and migration management
 */

import { Pool, PoolClient, QueryResult } from 'pg'
import { createHash } from 'crypto'

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
  host: process.env['DB_HOST'] || 'localhost',
  port: parseInt(process.env['DB_PORT'] || '5432'),
  database: process.env['DB_NAME'] || 'pixelated',
  user: process.env['DB_USER'] || 'postgres',
  password: process.env['DB_PASSWORD'] || '',
  max: parseInt(process.env['DB_MAX_CONNECTIONS'] || '20'),
  idleTimeoutMillis: parseInt(process.env['DB_IDLE_TIMEOUT'] || '30000'),
  connectionTimeoutMillis: parseInt(
    process.env['DB_CONNECTION_TIMEOUT'] || '2000',
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
  pool.on('error', (err: Error) => {
    console.error('Unexpected error on idle client', err)
    process.exit(-1)
  })

  pool.on('connect', (_client: PoolClient) => {
    console.log('New client connected to database')
  })

  console.log(
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
export async function query<T = unknown>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  const client = await getPool().connect()
  try {
    const result = await client.query(text, params)
    return result
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
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
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
        total: poolState.totalCount,
        idle: poolState.idleCount,
        waiting: poolState.waitingCount,
      },
    }
  } catch (error) {
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
    console.log('Database connection pool closed')
  }
}

/**
 * Create content hash for caching bias analysis results
 */
export function createContentHash(content: string, demographics: { age?: unknown; gender?: unknown; ethnicity?: unknown; primaryLanguage?: unknown }): string {
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

/**
 * Database migration utilities
 */
export class DatabaseMigration {
  private migrations: Map<string, string> = new Map()

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
      console.log(`Running migration: ${name}`)
      try {
        await query(sql)
        console.log(`✅ Migration ${name} completed`)
      } catch (error) {
        console.error(`❌ Migration ${name} failed:`, error)
        throw error
      }
    }
  }

  /**
   * Check if migrations table exists and create if needed
   */
  async ensureMigrationsTable(): Promise<void> {
    await query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
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
    const result = await query(
      'SELECT name FROM schema_migrations ORDER BY executed_at',
    )
    return result.rows.map((row) => row.name)
  }

  /**
   * Mark migration as executed
   */
  async markMigrationExecuted(name: string): Promise<void> {
    await query('INSERT INTO schema_migrations (name) VALUES ($1)', [name])
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
        userData.role || 'therapist',
        userData.institution,
        userData.licenseNumber,
      ],
    )

    return result.rows[0].id
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

    return result.rows[0] || null
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

    return result.rows[0] || null
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, profileData: any): Promise<void> {
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
        profileData.yearsExperience,
        profileData.certifications,
        profileData.languages || ['en'],
        profileData.timezone || 'UTC',
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
    context?: any
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
        sessionData.sessionType || 'individual',
        JSON.stringify(sessionData.context || {}),
      ],
    )

    return result.rows[0].id
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

    return result.rows[0] || null
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
    layerResults: any
    recommendations: string[]
    demographics: any
    contentHash: string
    processingTimeMs: number
  }): Promise<string> {
    const result = await query(
      `
      INSERT INTO bias_analyses (
        session_id, therapist_id, overall_bias_score, alert_level,
        confidence, layer_results, recommendations, demographics,
        content_hash, processing_time_ms
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `,
      [
        analysisData.sessionId,
        analysisData.therapistId,
        analysisData.overallBiasScore,
        analysisData.alertLevel,
        analysisData.confidence,
        JSON.stringify(analysisData.layerResults),
        analysisData.recommendations,
        JSON.stringify(analysisData.demographics),
        analysisData.contentHash,
        analysisData.processingTimeMs,
      ],
    )

    return result.rows[0].id
  }

  /**
   * Get cached analysis by content hash
   */
  async getCachedAnalysis(contentHash: string): Promise<any> {
    const result = await query(
      `
      SELECT * FROM bias_analyses
      WHERE content_hash = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
      [contentHash],
    )

    return result.rows[0] || null
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
      SELECT ba.*, s.started_at as session_date
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
        AND created_at >= NOW() - INTERVAL '${days} days'
    `,
      [therapistId],
    )

    return (
      result.rows[0] || {
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
  console.log('Received SIGINT, closing database connections...')
  await closeDatabase()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing database connections...')
  await closeDatabase()
  process.exit(0)
})
