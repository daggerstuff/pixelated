/**
 * Optimized Database Queries for Pixelated
 * High-performance queries with proper indexing, connection pooling, and query optimization
 */

import { PoolClient, QueryResult } from 'pg'
import { getPool } from './index'
import { getLogger } from '@/lib/logging'

const logger = getLogger('optimized-queries')

// Query performance configuration
const QUERY_CONFIG = {
  TIMEOUT_MS: 10000, // 10 seconds default timeout
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  SLOW_QUERY_THRESHOLD_MS: 1000,
  CONNECTION_TIMEOUT_MS: 5000,
}

// Optimized query plans and indexes
const OPTIMIZED_INDEXES = {
  BIAS_ANALYSES: [
    'CREATE INDEX IF NOT EXISTS idx_bias_analyses_therapist_created ON bias_analyses(therapist_id, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_bias_analyses_content_hash ON bias_analyses(content_hash)',
    'CREATE INDEX IF NOT EXISTS idx_bias_analyses_alert_level ON bias_analyses(alert_level)',
    'CREATE INDEX IF NOT EXISTS idx_bias_analyses_score ON bias_analyses(overall_bias_score)',
    'CREATE INDEX IF NOT EXISTS idx_bias_analyses_created_date ON bias_analyses(DATE(created_at))',
  ],
  SESSIONS: [
    'CREATE INDEX IF NOT EXISTS idx_sessions_therapist_state ON sessions(therapist_id, state)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_therapist_created ON sessions(therapist_id, created_at DESC)',
  ],
  USERS: [
    'CREATE INDEX IF NOT EXISTS idx_users_email_active ON users(email, is_active)',
    'CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, is_active)',
    'CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at DESC)',
  ],
}

/**
 * Execute query with timeout and performance monitoring
 */
export async function executeQuery<T = unknown>(
  text: string,
  params?: unknown[],
  options: {
    timeout?: number
    retries?: number
    name?: string
  } = {},
): Promise<QueryResult<T>> {
  const startTime = Date.now()
  const queryName = options.name || 'unnamed'
  const timeout = options.timeout || QUERY_CONFIG.TIMEOUT_MS
  const maxRetries = options.retries || QUERY_CONFIG.MAX_RETRIES

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Query timeout: ${queryName}`)),
          timeout,
        ),
      )

      // Execute query with timeout
      const queryPromise = getPool().query(text, params)
      const result = await Promise.race([queryPromise, timeoutPromise])

      const executionTime = Date.now() - startTime

      // Log slow queries
      if (executionTime > QUERY_CONFIG.SLOW_QUERY_THRESHOLD_MS) {
        logger.warn('Slow query detected', {
          queryName,
          executionTime,
          text: text.substring(0, 100), // First 100 chars
          attempt,
        })
      }

      // Log successful query
      logger.debug('Query executed successfully', {
        queryName,
        executionTime,
        rows: result.rowCount,
        attempt,
      })

      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      logger.warn(`Query attempt ${attempt} failed`, {
        queryName,
        error: lastError.message,
        attempt,
      })

      // Don't retry on timeout or connection errors
      if (
        lastError.message.includes('timeout') ||
        lastError.message.includes('connection')
      ) {
        throw lastError
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = QUERY_CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt - 1)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}

/**
 * Execute transaction with timeout and rollback on error
 */
export async function executeTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  options: {
    timeout?: number
    name?: string
  } = {},
): Promise<T> {
  const startTime = Date.now()
  const transactionName = options.name || 'unnamed'
  const timeout = options.timeout || QUERY_CONFIG.TIMEOUT_MS

  const client = await getPool().connect()

  try {
    // Set statement timeout for this connection
    await client.query(`SET statement_timeout = ${timeout}`)

    await client.query('BEGIN')

    const result = await callback(client)

    await client.query('COMMIT')

    const executionTime = Date.now() - startTime

    logger.debug('Transaction completed successfully', {
      transactionName,
      executionTime,
    })

    return result
  } catch (error) {
    await client.query('ROLLBACK')

    const executionTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    logger.error('Transaction failed', {
      transactionName,
      executionTime,
      error: errorMessage,
    })

    throw error
  } finally {
    client.release()
  }
}

/**
 * Optimized bias analysis queries
 */
export class OptimizedBiasQueries {
  /**
   * Get bias analyses with pagination and filtering
   */
  async getBiasAnalyses(
    options: {
      therapistId?: string
      clientId?: string
      alertLevels?: string[]
      dateFrom?: Date
      dateTo?: Date
      limit?: number
      offset?: number
      orderBy?: 'created_at' | 'overall_bias_score'
      orderDirection?: 'ASC' | 'DESC'
    } = {},
  ): Promise<{
    analyses: unknown[]
    total: number
    page: number
    pageSize: number
  }> {
    const {
      therapistId,
      clientId,
      alertLevels,
      dateFrom,
      dateTo,
      limit = 50,
      offset = 0,
      orderBy = 'created_at',
      orderDirection = 'DESC',
    } = options

    // Build WHERE conditions
    const conditions: string[] = []
    const params: unknown[] = []
    let paramIndex = 1

    if (therapistId) {
      conditions.push(`ba.therapist_id = $${paramIndex++}`)
      params.push(therapistId)
    }

    if (clientId) {
      conditions.push(`s.client_id = $${paramIndex++}`)
      params.push(clientId)
    }

    if (alertLevels && alertLevels.length > 0) {
      conditions.push(`ba.alert_level = ANY($${paramIndex++})`)
      params.push(alertLevels)
    }

    if (dateFrom) {
      conditions.push(`ba.created_at >= $${paramIndex++}`)
      params.push(dateFrom)
    }

    if (dateTo) {
      conditions.push(`ba.created_at <= $${paramIndex++}`)
      params.push(dateTo)
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Optimized query with proper joins and indexes
    const query = `
      SELECT 
        ba.id,
        ba.overall_bias_score,
        ba.alert_level,
        ba.confidence,
        ba.recommendations,
        ba.demographics,
        ba.processing_time_ms,
        ba.created_at,
        s.session_type,
        u.first_name as therapist_first_name,
        u.last_name as therapist_last_name,
        s.client_id
      FROM bias_analyses ba
      JOIN sessions s ON ba.session_id = s.id
      JOIN users u ON ba.therapist_id = u.id
      ${whereClause}
      ORDER BY ba.${orderBy} ${orderDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `

    params.push(limit, offset)

    // Execute main query
    const result = await executeQuery(query, params, {
      name: 'getBiasAnalyses',
    })

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM bias_analyses ba
      JOIN sessions s ON ba.session_id = s.id
      ${whereClause}
    `

    const countResult = await executeQuery(countQuery, params.slice(0, -2), {
      name: 'getBiasAnalysesCount',
    })
    const total = parseInt(countResult.rows[0].total)

    return {
      analyses: result.rows,
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
    }
  }

  /**
   * Get cached analysis by content hash (optimized)
   */
  async getCachedAnalysis(contentHash: string): Promise<unknown | null> {
    const query = `
      SELECT 
        ba.id,
        ba.overall_bias_score,
        ba.alert_level,
        ba.confidence,
        ba.layer_results,
        ba.recommendations,
        ba.demographics,
        ba.session_type,
        ba.created_at
      FROM bias_analyses ba
      WHERE ba.content_hash = $1
      ORDER BY ba.created_at DESC
      LIMIT 1
    `

    const result = await executeQuery(query, [contentHash], {
      name: 'getCachedAnalysis',
      timeout: 2000, // 2 second timeout for cache lookups
    })

    return result.rows[0] || null
  }

  /**
   * Get bias trend analysis for therapist
   */
  async getBiasTrend(
    therapistId: string,
    days: number = 30,
  ): Promise<{
    daily_scores: Array<{
      date: string
      avg_score: number
      analysis_count: number
      high_alerts: number
    }>
    overall_trend: 'improving' | 'stable' | 'worsening'
    avg_score_change: number
  }> {
    const query = `
      SELECT 
        DATE(ba.created_at) as date,
        ROUND(AVG(ba.overall_bias_score)::numeric, 3) as avg_score,
        COUNT(*) as analysis_count,
        COUNT(CASE WHEN ba.alert_level IN ('high', 'critical') THEN 1 END) as high_alerts
      FROM bias_analyses ba
      WHERE ba.therapist_id = $1 
        AND ba.created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(ba.created_at)
      ORDER BY date DESC
    `

    const result = await executeQuery(query, [therapistId], {
      name: 'getBiasTrend',
    })

    // Calculate trend
    const dailyScores = result.rows
    let overallTrend: 'improving' | 'stable' | 'worsening' = 'stable'
    let avgScoreChange = 0

    if (dailyScores.length >= 7) {
      const recentWeek = dailyScores.slice(0, 7)
      const previousWeek = dailyScores.slice(7, 14)

      if (recentWeek.length > 0 && previousWeek.length > 0) {
        const recentAvg =
          recentWeek.reduce((sum, day) => sum + parseFloat(day.avg_score), 0) /
          recentWeek.length
        const previousAvg =
          previousWeek.reduce(
            (sum, day) => sum + parseFloat(day.avg_score),
            0,
          ) / previousWeek.length

        avgScoreChange = recentAvg - previousAvg

        if (avgScoreChange < -0.05) {
          overallTrend = 'improving'
        } else if (avgScoreChange > 0.05) {
          overallTrend = 'worsening'
        }
      }
    }

    return {
      daily_scores: dailyScores,
      overall_trend: overallTrend,
      avg_score_change: Math.round(avgScoreChange * 1000) / 1000,
    }
  }

  /**
   * Get high-risk analyses for monitoring
   */
  async getHighRiskAnalyses(limit: number = 50): Promise<unknown[]> {
    const query = `
      SELECT 
        ba.id,
        ba.overall_bias_score,
        ba.alert_level,
        ba.confidence,
        ba.created_at,
        u.first_name as therapist_first_name,
        u.last_name as therapist_last_name,
        u.email as therapist_email,
        s.session_type
      FROM bias_analyses ba
      JOIN users u ON ba.therapist_id = u.id
      JOIN sessions s ON ba.session_id = s.id
      WHERE ba.alert_level IN ('high', 'critical')
        AND ba.created_at >= NOW() - INTERVAL '7 days'
      ORDER BY ba.overall_bias_score DESC, ba.created_at DESC
      LIMIT $1
    `

    const result = await executeQuery(query, [limit], {
      name: 'getHighRiskAnalyses',
    })

    return result.rows
  }

  /**
   * Get performance metrics for bias analysis
   */
  async getPerformanceMetrics(days: number = 30): Promise<{
    total_analyses: number
    avg_processing_time: number
    cache_hit_rate: number
    slow_queries: number
    error_rate: number
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_analyses,
        ROUND(AVG(ba.processing_time_ms)::numeric, 2) as avg_processing_time,
        ROUND(
          (COUNT(CASE WHEN ba.processing_time_ms < 1000 THEN 1 END) * 100.0 / COUNT(*))::numeric, 
          2
        ) as fast_queries_pct,
        COUNT(CASE WHEN ba.processing_time_ms > 5000 THEN 1 END) as slow_queries
      FROM bias_analyses ba
      WHERE ba.created_at >= NOW() - INTERVAL '${days} days'
    `

    const result = await executeQuery(query, [], {
      name: 'getPerformanceMetrics',
    })
    const row = result.rows[0]

    // Calculate cache hit rate from recent analyses with low processing time
    const cacheHitQuery = `
      SELECT 
        ROUND(
          (COUNT(CASE WHEN processing_time_ms < 500 THEN 1 END) * 100.0 / COUNT(*))::numeric, 
          2
        ) as cache_hit_rate
      FROM bias_analyses
      WHERE created_at >= NOW() - INTERVAL '1 day'
        AND processing_time_ms IS NOT NULL
    `

    const cacheResult = await executeQuery(cacheHitQuery, [], {
      name: 'getCacheHitRate',
    })
    const cacheHitRate = cacheResult.rows[0]?.cache_hit_rate || 0

    return {
      total_analyses: parseInt(row.total_analyses),
      avg_processing_time: parseFloat(row.avg_processing_time),
      cache_hit_rate: parseFloat(cacheHitRate),
      slow_queries: parseInt(row.slow_queries),
      error_rate: 0, // Would need error tracking table for real calculation
    }
  }
}

/**
 * Database optimization utilities
 */
export class DatabaseOptimizer {
  /**
   * Create optimized indexes
   */
  async createOptimizedIndexes(): Promise<void> {
    logger.info('Creating optimized database indexes')

    for (const [table, indexes] of Object.entries(OPTIMIZED_INDEXES)) {
      for (const indexSql of indexes) {
        try {
          await executeQuery(indexSql, [], { name: `createIndex_${table}` })
          logger.info(`Created index for ${table}`)
        } catch (error) {
          logger.warn(`Failed to create index for ${table}`, { error })
        }
      }
    }

    logger.info('Database index optimization completed')
  }

  /**
   * Analyze table statistics for query optimization
   */
  async analyzeTableStats(): Promise<void> {
    const tables = ['bias_analyses', 'sessions', 'users']

    for (const table of tables) {
      try {
        await executeQuery(`ANALYZE ${table}`, [], { name: `analyze_${table}` })
        logger.info(`Analyzed table ${table}`)
      } catch (error) {
        logger.warn(`Failed to analyze table ${table}`, { error })
      }
    }
  }

  /**
   * Vacuum tables to reclaim storage
   */
  async vacuumTables(): Promise<void> {
    const tables = ['bias_analyses', 'sessions', 'users']

    for (const table of tables) {
      try {
        await executeQuery(`VACUUM ANALYZE ${table}`, [], {
          name: `vacuum_${table}`,
        })
        logger.info(`Vacuumed table ${table}`)
      } catch (error) {
        logger.warn(`Failed to vacuum table ${table}`, { error })
      }
    }
  }

  /**
   * Get database performance statistics
   */
  async getDatabaseStats(): Promise<{
    table_sizes: Array<{ table: string; size: string; rows: number }>
    index_usage: Array<{ index: string; usage: number }>
    query_performance: Array<{ query: string; avg_time: number; calls: number }>
  }> {
    // Get table sizes
    const tableSizeQuery = `
      SELECT 
        relname as table,
        pg_size_pretty(pg_total_relation_size(relid)) as size,
        n_live_tup as rows
      FROM pg_catalog.pg_statio_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
    `

    const tableSizeResult = await executeQuery(tableSizeQuery, [], {
      name: 'getTableSizes',
    })

    // Get index usage
    const indexUsageQuery = `
      SELECT 
        indexrelname as index,
        idx_tup_read + idx_tup_fetch as usage
      FROM pg_stat_user_indexes
      ORDER BY usage DESC
      LIMIT 10
    `

    const indexUsageResult = await executeQuery(indexUsageQuery, [], {
      name: 'getIndexUsage',
    })

    // Get query performance (if pg_stat_statements is enabled)
    let queryPerformance: Array<{
      query: string
      avg_time: number
      calls: number
    }> = []

    try {
      const queryPerfQuery = `
        SELECT 
          substring(query from 1 for 50) as query,
          round(mean_exec_time::numeric, 2) as avg_time,
          calls
        FROM pg_stat_statements
        ORDER BY mean_exec_time DESC
        LIMIT 10
      `

      const queryPerfResult = await executeQuery(queryPerfQuery, [], {
        name: 'getQueryPerformance',
      })
      queryPerformance = queryPerfResult.rows
    } catch (error) {
      logger.warn('pg_stat_statements not available', { error })
    }

    return {
      table_sizes: tableSizeResult.rows,
      index_usage: indexUsageResult.rows,
      query_performance: queryPerformance,
    }
  }
}

// Export singleton instances
export const optimizedBiasQueries = new OptimizedBiasQueries()
export const databaseOptimizer = new DatabaseOptimizer()

// Performance monitoring
export async function monitorQueryPerformance(): Promise<void> {
  const stats = await databaseOptimizer.getDatabaseStats()

  logger.info('Database performance monitoring', {
    tableCount: stats.table_sizes.length,
    totalRows: stats.table_sizes.reduce(
      (sum, table) => sum + parseInt(table.rows),
      0,
    ),
    slowQueries: stats.query_performance.length,
  })

  // Alert on slow queries
  stats.query_performance.forEach((query) => {
    if (query.avg_time > 1000) {
      // Queries taking more than 1 second
      logger.warn('Slow query detected', {
        query: query.query,
        avgTime: query.avg_time,
        calls: query.calls,
      })
    }
  })
}
