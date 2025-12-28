import { createHash } from 'crypto'
import { getLogger } from '@/lib/utils/logger'
import {
  ResearchQuery,
  QueryResult,
  QueryApproval,
} from '@/lib/research/types/research-types'
import { AnonymizationService } from './AnonymizationService'
import { ConsentManagementService } from './ConsentManagementService'
import { HIPAADataService } from './HIPAADataService'

const logger = getLogger('ResearchQueryEngine')

export interface QueryEngineConfig {
  maxQueryComplexity: number
  maxResultSize: number
  approvalRequired: boolean
  queryTimeout: number
  cacheEnabled: boolean
}

export interface NaturalLanguageQuery {
  text: string
  context?: string
  expectedOutput?: string
}

export interface QueryPerformanceMetrics {
  executionTime: number
  resultSize: number
  complexityScore: number
  cacheHit: boolean
}

export class ResearchQueryEngine {
  private config: QueryEngineConfig
  private anonymizationService: AnonymizationService
  private consentService: ConsentManagementService
  private hipaaService: HIPAADataService
  private queryCache: Map<string, { result: QueryResult; timestamp: Date }> =
    new Map()
  private pendingApprovals: Map<string, QueryApproval> = new Map()

  constructor(
    config: QueryEngineConfig = {
      maxQueryComplexity: 1000,
      maxResultSize: 10000,
      approvalRequired: true,
      queryTimeout: 30000,
      cacheEnabled: true,
    },
    anonymizationService: AnonymizationService,
    consentService: ConsentManagementService,
    hipaaService: HIPAADataService,
  ) {
    this.config = config
    this.anonymizationService = anonymizationService
    this.consentService = consentService
    this.hipaaService = hipaaService
  }

  /**
   * Main query execution pipeline
   */
  async executeQuery(
    query: ResearchQuery,
    userId: string,
    userRole: string,
  ): Promise<QueryResult> {
    const startTime = Date.now()

    logger.info('Processing research query', {
      queryId: query.id,
      userId,
      userRole,
      queryType: query.type,
    })

    try {
      // Step 1: Validate query
      const validation = await this.validateQuery(query, userId, userRole)
      if (!validation.valid) {
        throw new Error(
          `Query validation failed: ${validation.errors.join(', ')}`,
        )
      }

      // Step 2: Check approval requirements
      if (this.config.approvalRequired && query.requiresApproval) {
        const approval = await this.requestQueryApproval(query, userId)
        if (approval.status !== 'approved') {
          return {
            queryId: query.id,
            status: 'pending-approval',
            data: null,
            metadata: {},
          }
        }
      }

      // Step 3: Check cache
      if (this.config.cacheEnabled) {
        const cached = this.getCachedResult(query)
        if (cached) {
          logger.info('Returning cached result', { queryId: query.id })
          return {
            ...cached,
            metadata: { ...cached.metadata, cacheHit: true },
          }
        }
      }

      // Step 4: Execute query
      const result = await this.executeQueryInternal(query, userId, userRole)

      // Step 5: Apply anonymization
      const anonymizedResult = await this.anonymizeQueryResult(
        result,
        query.anonymizationLevel,
      )

      // Step 6: Cache result
      if (this.config.cacheEnabled) {
        this.cacheResult(query, anonymizedResult)
      }

      // Step 7: Log performance metrics
      const metrics: QueryPerformanceMetrics = {
        executionTime: Date.now() - startTime,
        resultSize: anonymizedResult.data?.length || 0,
        complexityScore: this.calculateComplexityScore(query),
        cacheHit: false,
      }

      logger.info('Query execution completed', {
        queryId: query.id,
        metrics,
      })

      return {
        ...anonymizedResult,
        metadata: { ...anonymizedResult.metadata, ...metrics },
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Query execution failed', {
        queryId: query.id,
        error: errorMessage,
      })

      return {
        queryId: query.id,
        status: 'error',
        data: null,
        error: errorMessage,
        metadata: { executionTime: Date.now() - startTime },
      }
    }
  }

  /**
   * Convert natural language to SQL query
   */
  async naturalLanguageToQuery(
    nlQuery: NaturalLanguageQuery,
  ): Promise<ResearchQuery> {
    logger.info('Converting natural language to query', { nlQuery })

    try {
      // Parse natural language query
      const parsed = await this.parseNaturalLanguage(
        nlQuery.text,
        nlQuery.context,
      )

      // Generate SQL query
      const sqlQuery = this.generateSQLQuery(parsed)

      // Create research query
      const query: ResearchQuery = {
        id: crypto.randomUUID(),
        type: 'sql',
        sql: sqlQuery,
        parameters: parsed.parameters || {},
        description: nlQuery.text,
        context: nlQuery.context,
        expectedOutput: nlQuery.expectedOutput,
        requiresApproval: this.requiresApproval(parsed),
        anonymizationLevel: 'high',
        createdAt: new Date().toISOString(),
        createdBy: 'system',
      }

      logger.info('Natural language query converted', {
        queryId: query.id,
        sql: sqlQuery,
      })

      return query
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Natural language parsing failed', { error: errorMessage })
      throw new Error(
        `Failed to parse natural language query: ${errorMessage}`,
        { cause: error },
      )
    }
  }

  /**
   * Execute pattern discovery queries
   */
  async discoverPatterns(
    patternType: 'correlation' | 'trend' | 'anomaly' | 'cluster',
    parameters: Record<string, unknown>,
    userId: string,
    userRole: string,
  ): Promise<QueryResult> {
    logger.info('Starting pattern discovery', { patternType, parameters })

    const query: ResearchQuery = {
      id: crypto.randomUUID(),
      type: 'pattern-discovery',
      sql: this.generatePatternQuery(patternType, parameters),
      parameters,
      description: `Pattern discovery: ${patternType}`,
      requiresApproval: true,
      anonymizationLevel: 'high',
      createdAt: new Date().toISOString(),
      createdBy: userId,
    }

    return this.executeQuery(query, userId, userRole)
  }

  /**
   * Execute longitudinal analysis
   */
  async longitudinalAnalysis(
    clientIds: string[],
    metrics: string[],
    timeRange: { start: Date; end: Date },
    userId: string,
    userRole: string,
  ): Promise<QueryResult> {
    logger.info('Starting longitudinal analysis', {
      clientCount: clientIds.length,
      metrics,
      timeRange,
    })

    // Validate consent for all clients
    const consentValidation = await this.consentService.validateResearchAccess(
      clientIds,
      'anonymizedResearch',
    )

    if (consentValidation.invalidClients.length > 0) {
      throw new Error(
        `Consent validation failed for clients: ${consentValidation.invalidClients.join(', ')}`,
      )
    }

    const query: ResearchQuery = {
      id: crypto.randomUUID(),
      type: 'longitudinal-analysis',
      sql: this.generateLongitudinalQuery(metrics, timeRange),
      parameters: { clientIds, metrics, timeRange },
      description: `Longitudinal analysis for ${clientIds.length} clients`,
      requiresApproval: true,
      anonymizationLevel: 'high',
      createdAt: new Date().toISOString(),
      createdBy: userId,
    }

    return this.executeQuery(query, userId, userRole)
  }

  /**
   * Execute cohort comparison
   */
  async cohortComparison(
    cohorts: Array<{
      name: string
      criteria: Record<string, unknown>
      clientIds: string[]
    }>,
    metrics: string[],
    userId: string,
    userRole: string,
  ): Promise<QueryResult> {
    logger.info('Starting cohort comparison', {
      cohortCount: cohorts.length,
      metrics,
    })

    // Validate consent for all clients
    const allClientIds = cohorts.flatMap((c) => c.clientIds)
    const consentValidation = await this.consentService.validateResearchAccess(
      allClientIds,
      'anonymizedResearch',
    )

    if (consentValidation.invalidClients.length > 0) {
      throw new Error(
        `Consent validation failed for clients: ${consentValidation.invalidClients.join(', ')}`,
      )
    }

    const query: ResearchQuery = {
      id: crypto.randomUUID(),
      type: 'cohort-comparison',
      sql: this.generateCohortQuery(cohorts, metrics),
      parameters: { cohorts, metrics },
      description: `Cohort comparison: ${cohorts.map((c) => c.name).join(', ')}`,
      requiresApproval: true,
      anonymizationLevel: 'high',
      createdAt: new Date().toISOString(),
      createdBy: userId,
    }

    return this.executeQuery(query, userId, userRole)
  }

  /**
   * Request query approval
   */
  async requestQueryApproval(
    query: ResearchQuery,
    requesterId: string,
  ): Promise<QueryApproval> {
    const approval: QueryApproval = {
      id: crypto.randomUUID(),
      queryId: query.id,
      requesterId,
      approverId: null,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      reviewedAt: null,
      comments: null,
      restrictions: [],
    }

    this.pendingApprovals.set(approval.id, approval)

    logger.info('Query approval requested', {
      approvalId: approval.id,
      queryId: query.id,
    })

    return approval
  }

  /**
   * Approve or reject query
   */
  async approveQuery(
    approvalId: string,
    approverId: string,
    approved: boolean,
    comments?: string,
    restrictions?: string[],
  ): Promise<QueryApproval> {
    const approval = this.pendingApprovals.get(approvalId)
    if (!approval) {
      throw new Error(`Approval request not found: ${approvalId}`)
    }

    approval.status = approved ? 'approved' : 'rejected'
    approval.approverId = approverId
    approval.reviewedAt = new Date().toISOString()
    approval.comments = comments ?? null
    approval.restrictions = restrictions || []

    logger.info('Query approval decision', {
      approvalId,
      approved,
      approverId,
    })

    return approval
  }

  /**
   * Get query approval status
   */
  async getApprovalStatus(queryId: string): Promise<QueryApproval | null> {
    for (const approval of this.pendingApprovals.values()) {
      if (approval.queryId === queryId) {
        return approval
      }
    }
    return null
  }

  /**
   * Get query performance statistics
   */
  async getQueryStatistics(
    _userId?: string,
    _dateRange?: { start: Date; end: Date },
  ): Promise<{
    totalQueries: number
    successfulQueries: number
    failedQueries: number
    averageExecutionTime: number
    mostCommonQueryTypes: Array<{ type: string; count: number }>
    userStatistics: Array<{ userId: string; queryCount: number }>
  }> {
    // In a real implementation, this would query a database
    const stats = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageExecutionTime: 0,
      mostCommonQueryTypes: [],
      userStatistics: [],
    }

    return stats
  }

  /**
   * Private methods
   */
  private async validateQuery(
    query: ResearchQuery,
    userId: string,
    userRole: string,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    // Check query complexity
    const complexity = this.calculateComplexityScore(query)
    if (complexity > this.config.maxQueryComplexity) {
      errors.push(
        `Query complexity ${complexity} exceeds maximum ${this.config.maxQueryComplexity}`,
      )
    }

    // Check user permissions
    const hasPermission = await this.checkUserPermissions(
      userId,
      userRole,
      query.type,
    )
    if (!hasPermission) {
      errors.push(
        `User ${userId} lacks permission for query type ${query.type}`,
      )
    }

    // Validate SQL syntax (basic check)
    if (query.type === 'sql' && query.sql) {
      const sqlValid = this.validateSQLSyntax(query.sql)
      if (!sqlValid) {
        errors.push('Invalid SQL syntax')
      }
    }

    return { valid: errors.length === 0, errors }
  }

  private calculateComplexityScore(query: ResearchQuery): number {
    let score = 0

    // SQL complexity
    if (query.sql) {
      score += query.sql.split(' ').length
      score += (query.sql.match(/JOIN/gi) || []).length * 10
      score += (query.sql.match(/WHERE/gi) || []).length * 5
      score += (query.sql.match(/GROUP BY/gi) || []).length * 15
    }

    // Parameter complexity
    score += Object.keys(query.parameters || {}).length * 2

    return score
  }

  private async checkUserPermissions(
    userId: string,
    userRole: string,
    queryType: string,
  ): Promise<boolean> {
    const permissions = {
      'researcher': ['sql', 'pattern-discovery', 'aggregate-analysis'],
      'data-scientist': [
        'sql',
        'pattern-discovery',
        'longitudinal-analysis',
        'cohort-comparison',
      ],
      'therapist': ['own-client-analysis'],
      'admin': ['all'],
    }

    const userPermissions = permissions[userRole] || []
    return (
      userPermissions.includes(queryType) || userPermissions.includes('all')
    )
  }

  private validateSQLSyntax(sql: string): boolean {
    // Basic SQL validation
    const requiredKeywords = ['SELECT', 'FROM']
    return requiredKeywords.every((keyword) =>
      sql.toUpperCase().includes(keyword),
    )
  }

  private async parseNaturalLanguage(
    text: string,
    _context?: string,
  ): Promise<{
    intent: string
    entities: Record<string, unknown>
    parameters: Record<string, unknown>
  }> {
    // Simple NLP parsing - in production, use proper NLP service
    const intent = 'aggregate-analysis'
    const entities: Record<string, unknown> = {}
    const parameters: Record<string, unknown> = {}

    if (text.includes('emotion') || text.includes('feelings')) {
      entities.topic = 'emotion-analysis'
    }

    if (text.includes('technique') || text.includes('approach')) {
      entities.topic = 'technique-effectiveness'
    }

    return { intent, entities, parameters }
  }

  private generateSQLQuery(_parsed: Record<string, unknown>): string {
    const baseQuery = `
      SELECT 
        COUNT(*) as record_count,
        AVG(emotion_scores->>'happiness') as avg_happiness,
        AVG(emotion_scores->>'sadness') as avg_sadness,
        AVG(technique_effectiveness->>'cognitive_restructuring') as avg_cognitive_restructuring
      FROM research_data
      WHERE created_at >= $1 AND created_at <= $2
      AND consent_level >= $3
    `

    return baseQuery
  }

  private generatePatternQuery(
    patternType: string,
    _parameters: Record<string, unknown>,
  ): string {
    const queries = {
      correlation: `
        SELECT 
          technique_type,
          emotion_type,
          CORR(technique_score, emotion_score) as correlation
        FROM research_data
        WHERE created_at >= $1 AND created_at <= $2
        GROUP BY technique_type, emotion_type
        HAVING COUNT(*) > 10
      `,
      trend: `
        SELECT 
          DATE_TRUNC('week', created_at) as week,
          AVG(emotion_scores->>'overall') as avg_emotion,
          AVG(technique_effectiveness->>'overall') as avg_effectiveness
        FROM research_data
        WHERE created_at >= $1 AND created_at <= $2
        GROUP BY week
        ORDER BY week
      `,
      anomaly: `
        SELECT *
        FROM research_data
        WHERE created_at >= $1 AND created_at <= $2
        AND (
          emotion_scores->>'overall' > (SELECT AVG(emotion_scores->>'overall') + 2 * STDDEV(emotion_scores->>'overall') FROM research_data)
          OR emotion_scores->>'overall' < (SELECT AVG(emotion_scores->>'overall') - 2 * STDDEV(emotion_scores->>'overall') FROM research_data)
        )
      `,
      cluster: `
        SELECT 
          client_id,
          AVG(emotion_scores->>'happiness') as avg_happiness,
          AVG(emotion_scores->>'sadness') as avg_sadness,
          AVG(technique_effectiveness->>'overall') as avg_effectiveness
        FROM research_data
        WHERE created_at >= $1 AND created_at <= $2
        GROUP BY client_id
        HAVING COUNT(*) > 5
      `,
    }

    return queries[patternType] || queries['correlation']
  }

  private generateLongitudinalQuery(
    metrics: string[],
    _timeRange: { start: Date; end: Date },
  ): string {
    return `
      SELECT 
        client_id,
        DATE_TRUNC('week', created_at) as week,
        ${metrics.map((m) => `AVG(${m}) as ${m}`).join(',\n        ')}
      FROM research_data
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY client_id, week
      ORDER BY client_id, week
    `
  }

  private generateCohortQuery(
    cohorts: Array<{
      name: string
      criteria: Record<string, unknown>
      clientIds: string[]
    }>,
    metrics: string[],
  ): string {
    const cohortCases = cohorts
      .map(
        (cohort, index) =>
          `WHEN client_id = ANY($${index + 3}) THEN '${cohort.name}'`,
      )
      .join('\n        ')

    return `
      SELECT 
        CASE 
          ${cohortCases}
          ELSE 'Other'
        END as cohort,
        ${metrics.map((m) => `AVG(${m}) as ${m}`).join(',\n        ')},
        COUNT(*) as sample_size
      FROM research_data
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY cohort
      ORDER BY cohort
    `
  }

  private async anonymizeQueryResult(
    result: QueryResult,
    anonymizationLevel: string,
  ): Promise<QueryResult> {
    if (!result.data || anonymizationLevel === 'none') {
      return result
    }

    // Map anonymization levels to consent levels
    const levelMapping: Record<string, 'full' | 'limited' | 'minimal'> = {
      low: 'minimal',
      medium: 'limited',
      high: 'full',
    }

    const consentLevel = levelMapping[anonymizationLevel] || 'full'

    // Apply anonymization based on level
    const anonymizedData =
      await this.anonymizationService.anonymizeResearchData(
        result.data,
        consentLevel,
      )

    return {
      ...result,
      data: anonymizedData.anonymizedData,
      metadata: {
        ...result.metadata,
        anonymizationMetrics: anonymizedData.privacyMetrics,
        anonymizationAudit: anonymizedData.auditLog,
      },
    }
  }

  private requiresApproval(_parsed: Record<string, unknown>): boolean {
    // Determine if query requires approval based on sensitivity
    return true // Conservative approach
  }

  private getCachedResult(query: ResearchQuery): QueryResult | null {
    const cacheKey = this.generateCacheKey(query)
    const cached = this.queryCache.get(cacheKey)

    if (cached && cached.timestamp > new Date(Date.now() - 3600000)) {
      // 1 hour cache
      return cached.result
    }

    return null
  }

  private cacheResult(query: ResearchQuery, result: QueryResult): void {
    const cacheKey = this.generateCacheKey(query)
    this.queryCache.set(cacheKey, {
      result,
      timestamp: new Date(),
    })

    // Limit cache size
    if (this.queryCache.size > 100) {
      const oldestKey = this.queryCache.keys().next().value as string
      if (oldestKey) {
        this.queryCache.delete(oldestKey)
      }
    }
  }

  private generateCacheKey(query: ResearchQuery): string {
    return createHash('sha256')
      .update(JSON.stringify({ sql: query.sql, parameters: query.parameters }))
      .digest('hex')
  }

  private async executeQueryInternal(
    query: ResearchQuery,
    _userId: string,
    _userRole: string,
  ): Promise<QueryResult> {
    // In a real implementation, this would execute against a database
    logger.info('Executing query', { queryId: query.id, sql: query.sql })

    // Mock result for demonstration
    return {
      queryId: query.id,
      status: 'success',
      data: [],
      metadata: {
        executionTime: 0,
        resultSize: 0,
        complexityScore: this.calculateComplexityScore(query),
      },
    }
  }
}
