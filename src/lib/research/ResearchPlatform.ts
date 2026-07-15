import {
  ResearchPlatformConfig,
  ResearchQuery,
  ResearchAPIResponse,
  ResearchDataPoint,
  ConsentLevel,
  ValidationResult,
  SystemMetrics,
  ResearchConsent,
  Alert,
  AuditLog,
} from '@/lib/research/types/research-types'
import { getLogger } from '@/lib/utils/logger'

import { AnonymizationService } from './services/AnonymizationService'
import {
  ConsentManagementService,
  type ConsentUpdate,
} from './services/ConsentManagementService'
import {
  EvidenceGenerationService,
  type EvidenceRequest,
} from './services/EvidenceGenerationService'
import { HIPAADataService } from './services/HIPAADataService'
import {
  PatternDiscoveryService,
  type DiscoveryRequest,
} from './services/PatternDiscoveryService'
import { ResearchQueryEngine } from './services/ResearchQueryEngine'

const logger = getLogger('ResearchPlatform')

export interface PlatformStatus {
  healthy: boolean
  services: {
    anonymization: boolean
    consent: boolean
    hipaa: boolean
    queryEngine: boolean
    patternDiscovery: boolean
    evidenceGeneration: boolean
  }
  metrics: SystemMetrics
  alerts: Alert[]
}

export class ResearchPlatform {
  private readonly config: ResearchPlatformConfig
  private readonly anonymizationService: AnonymizationService
  private readonly consentService: ConsentManagementService
  private readonly hipaaService: HIPAADataService
  private readonly queryEngine: ResearchQueryEngine
  private readonly patternService: PatternDiscoveryService
  private readonly evidenceService: EvidenceGenerationService
  private isInitialized = false
  private readonly alerts: Alert[] = []
  private platformAuditLog: AuditLog[] = []

  constructor(
    config: ResearchPlatformConfig = {
      anonymization: {
        kAnonymity: 5,
        differentialPrivacyEpsilon: 0.1,
        noiseInjection: true,
        temporalObfuscation: true,
      },
      consent: {
        defaultLevel: 'minimal',
        expirationDays: 365,
        withdrawalGracePeriodHours: 24,
      },
      queryEngine: {
        maxComplexity: 1000,
        maxResultSize: 10000,
        approvalRequired: true,
        cacheEnabled: true,
      },
      hipaa: {
        encryptionAlgorithm: 'aes-256-gcm',
        keyRotationDays: 90,
        auditRetentionDays: 2555,
      },
    },
  ) {
    this.config = config

    // Initialize services
    this.anonymizationService = new AnonymizationService({
      kAnonymity: config.anonymization.kAnonymity,
      epsilon: config.anonymization.differentialPrivacyEpsilon,
      delta: 0.00001,
      temporalEpsilon: 0.05,
      fieldLevelEncryption: true,
      noiseInjection: config.anonymization.noiseInjection,
    })

    this.consentService = new ConsentManagementService({
      defaultConsentLevel: config.consent.defaultLevel,
      consentExpirationDays: config.consent.expirationDays,
      withdrawalGracePeriodHours: config.consent.withdrawalGracePeriodHours,
      auditRetentionDays: 2555,
    })

    this.hipaaService = new HIPAADataService({
      encryptionAlgorithm: config.hipaa.encryptionAlgorithm,
      keyRotationDays: config.hipaa.keyRotationDays,
      auditRetentionDays: config.hipaa.auditRetentionDays,
      accessControlMatrix: {
        roles: {
          'researcher': {
            permissions: ['read-anonymized', 'aggregate-analysis'],
            restrictions: ['no-identifiable', 'no-raw-phi'],
          },
          'data-scientist': {
            permissions: [
              'read-anonymized',
              'read-pseudonymized',
              'aggregate-analysis',
              'pattern-discovery',
            ],
            restrictions: ['no-identifiable', 'audit-required'],
          },
          'therapist': {
            permissions: [
              'read-own-clients',
              'write-notes',
              'clinical-analysis',
            ],
            restrictions: ['own-clients-only', 'no-research-export'],
          },
          'admin': {
            permissions: ['full-access', 'user-management', 'audit-review'],
            restrictions: ['audit-required', 'dual-authorization'],
          },
        },
      },
      dataRetentionPolicies: {
        'session-data': {
          retentionDays: 2555,
          anonymizationRequired: true,
          deletionRequired: false,
        },
        'clinical-notes': {
          retentionDays: 2555,
          anonymizationRequired: false,
          deletionRequired: false,
        },
        'research-data': {
          retentionDays: 2555,
          anonymizationRequired: true,
          deletionRequired: false,
        },
        'audit-logs': {
          retentionDays: 2555,
          anonymizationRequired: false,
          deletionRequired: false,
        },
      },
    })

    this.queryEngine = new ResearchQueryEngine(
      {
        maxQueryComplexity: config.queryEngine.maxComplexity,
        maxResultSize: config.queryEngine.maxResultSize,
        approvalRequired: config.queryEngine.approvalRequired,
        queryTimeout: 30000,
        cacheEnabled: config.queryEngine.cacheEnabled,
      },
      this.anonymizationService,
      this.consentService,
      this.hipaaService,
    )

    this.patternService = new PatternDiscoveryService(
      {
        significanceThreshold: 0.05,
        minSampleSize: 30,
        maxPatterns: 10,
        correlationThreshold: 0.3,
        anomalyThreshold: 2.0,
        clusterCount: 5,
      },
      this.queryEngine,
    )

    this.evidenceService = new EvidenceGenerationService(
      {
        significanceLevel: 0.05,
        minEffectSize: 0.3,
        minSampleSize: 30,
        confidenceLevel: 0.95,
        maxHypotheses: 10,
      },
      this.patternService,
      this.queryEngine,
    )
  }

  /**
   * Initialize the research platform
   */
  async initialize(): Promise<ResearchAPIResponse> {
    logger.info('Initializing Research Platform')

    try {
      // Validate configuration
      const validation = await this.validateConfiguration()
      if (!validation.valid) {
        throw new Error(
          `Configuration validation failed: ${validation.errors.join(', ')}`,
        )
      }

      // Initialize services
      await this.initializeServices()

      // Run health checks
      const healthCheck = await this.performHealthCheck()
      if (!healthCheck.healthy) {
        throw new Error('Health check failed')
      }

      this.isInitialized = true

      logger.info('Research Platform initialized successfully')

      return {
        success: true,
        data: { status: 'initialized', timestamp: new Date().toISOString() },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
          processingTime: 0,
        },
      }
    } catch (error: unknown) {
      logger.error('Research Platform initialization failed', { error })

      return {
        success: false,
        error: {
          code: 'INITIALIZATION_ERROR',
          message:
            error instanceof Error
              ? error instanceof Error
                ? error.message
                : 'Unknown error'
              : 'Unknown error',
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
          processingTime: 0,
        },
      }
    }
  }

  /**
   * Get platform status
   */
  async getStatus(): Promise<ResearchAPIResponse<PlatformStatus>> {
    if (!this.isInitialized) {
      return {
        success: false,
        error: {
          code: 'STATUS_ERROR',
          message: 'Research platform not initialized',
        },
      }
    }

    try {
      const healthCheck = await this.performHealthCheck()
      const metrics = await this.collectMetrics()

      return {
        success: true,
        data: {
          healthy: healthCheck.healthy,
          services: healthCheck.services,
          metrics,
          alerts: this.alerts,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
          processingTime: 0,
        },
      }
    } catch (error: unknown) {
      return {
        success: false,
        error: {
          code: 'STATUS_ERROR',
          message:
            error instanceof Error
              ? error instanceof Error
                ? error.message
                : 'Unknown error'
              : 'Unknown error',
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
          processingTime: 0,
        },
      }
    }
  }

  /**
   * Submit research data for anonymization
   */
  async submitResearchData(
    data: unknown[],
    consentLevel: string,
    userId: string,
  ): Promise<ResearchAPIResponse> {
    if (!this.isInitialized) {
      return {
        success: false,
        error: {
          code: 'NOT_INITIALIZED',
          message: 'Research platform not initialized',
        },
      }
    }

    try {
      // Validate consent
      const sanitizedData = this.normalizeResearchData(data)
      const clientIds = sanitizedData.map((d) => d.clientId)
      const consentValidation =
        await this.consentService.validateResearchAccess(
          clientIds,
          'anonymizedResearch',
        )

      if (consentValidation.invalidClients.length > 0) {
        this.recordAudit({
          action: 'submit_research_data',
          userId,
          clientIds,
          timestamp: new Date().toISOString(),
          details: {
            status: 'error',
            reason: 'CONSENT_ERROR',
          },
        })

        return {
          success: false,
          error: {
            code: 'CONSENT_ERROR',
            message: `Consent validation failed for clients: ${consentValidation.invalidClients.join(', ')}`,
          },
        }
      }

      // Anonymize data
      const anonymized = await this.anonymizationService.anonymizeResearchData(
        sanitizedData,
        this.mapConsentLevelForAnonymization(consentLevel),
      )

      // Encrypt sensitive data
      const encrypted = await this.hipaaService.encryptData(
        anonymized.anonymizedData,
        'research-data',
        clientIds[0] ?? undefined,
      )

      this.recordAudit({
        action: 'submit_research_data',
        userId,
        clientIds,
        timestamp: new Date().toISOString(),
        details: {
          status: 'success',
        },
      })

      return {
        success: true,
        data: {
          anonymizedCount: anonymized.anonymizedData.length,
          privacyMetrics: anonymized.privacyMetrics,
          encryptedData: encrypted.encryptedData,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
          processingTime: 0,
        },
      }
    } catch (error: unknown) {
      const clientIds = this.extractClientIdsFromUnknownData(data)
      this.recordAudit({
        action: 'submit_research_data',
        userId,
        clientIds,
        timestamp: new Date().toISOString(),
        details: {
          status: 'error',
          message:
            error instanceof Error
              ? error instanceof Error
                ? error.message
                : 'Unknown error'
              : 'Unknown error',
        },
      })

      return {
        success: false,
        error: {
          code: 'SUBMISSION_ERROR',
          message:
            error instanceof Error
              ? error instanceof Error
                ? error.message
                : 'Unknown error'
              : 'Unknown error',
        },
      }
    }
  }

  /**
   * Execute research query
   */
  async executeResearchQuery(
    query: unknown,
    userId: string,
    userRole: string,
  ): Promise<ResearchAPIResponse> {
    if (!this.isInitialized) {
      return {
        success: false,
        error: {
          code: 'NOT_INITIALIZED',
          message: 'Research platform not initialized',
        },
      }
    }

    try {
      // Validate user access
      const accessRequest = {
        userId,
        role: userRole,
        dataType: 'research-data',
        purpose: 'research-analysis',
      }

      const accessResult = await this.hipaaService.validateAccess(accessRequest)
      if (!accessResult.granted) {
        this.recordAudit({
          action: 'execute_research_query',
          userId,
          timestamp: new Date().toISOString(),
          details: {
            status: 'denied',
            reason: 'ACCESS_DENIED',
            role: userRole,
          },
        })

        return {
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied for research query',
          },
        }
      }

      // Execute query
      const parsedQuery = this.parseResearchQuery(query)
      if (!parsedQuery) {
        return {
          success: false,
          error: {
            code: 'QUERY_ERROR',
            message: 'Invalid research query format',
          },
        }
      }

      const result = await this.queryEngine.executeQuery(
        parsedQuery,
        userId,
        userRole,
      )
      if (result.status !== 'success') {
        this.recordAudit({
          action: 'execute_research_query',
          userId,
          timestamp: new Date().toISOString(),
          details: {
            status: 'error',
            queryStatus: result.status,
            reason: result.error,
          },
        })

        return {
          success: false,
          error: {
            code: 'QUERY_ERROR',
            message:
              result.error ??
              `Query execution failed with status ${result.status}`,
          },
        }
      }

      this.recordAudit({
        action: 'execute_research_query',
        userId,
        timestamp: new Date().toISOString(),
        details: {
          status: 'success',
        },
      })

      return {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
          processingTime: result.metadata?.executionTime ?? 0,
        },
      }
    } catch (error: unknown) {
      return {
        success: false,
        error: {
          code: 'QUERY_ERROR',
          message:
            error instanceof Error
              ? error instanceof Error
                ? error.message
                : 'Unknown error'
              : 'Unknown error',
        },
      }
    }
  }

  /**
   * Discover patterns in research data
   */
  async discoverPatterns(
    request: unknown,
    userId: string,
    userRole: string,
  ): Promise<ResearchAPIResponse> {
    if (!this.isInitialized) {
      return {
        success: false,
        error: {
          code: 'NOT_INITIALIZED',
          message: 'Research platform not initialized',
        },
      }
    }

    try {
      // Validate access
      const accessRequest = {
        userId,
        role: userRole,
        dataType: 'research-data',
        purpose: 'pattern-discovery',
      }

      const accessResult = await this.hipaaService.validateAccess(accessRequest)
      if (!accessResult.granted) {
        return {
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied for pattern discovery',
          },
        }
      }

      // Discover patterns
      const discoveryRequest = this.parseDiscoveryRequest(request)
      if (!discoveryRequest) {
        return {
          success: false,
          error: {
            code: 'PATTERN_ERROR',
            message: 'Invalid pattern discovery request format',
          },
        }
      }

      const patterns =
        await this.patternService.discoverPatterns(discoveryRequest)

      return {
        success: true,
        data: patterns,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
          processingTime: patterns.metadata.processingTime,
        },
      }
    } catch (error: unknown) {
      return {
        success: false,
        error: {
          code: 'PATTERN_ERROR',
          message:
            error instanceof Error
              ? error instanceof Error
                ? error.message
                : 'Unknown error'
              : 'Unknown error',
        },
      }
    }
  }

  /**
   * Generate evidence report
   */
  async generateEvidenceReport(
    request: unknown,
    userId: string,
    userRole: string,
  ): Promise<ResearchAPIResponse> {
    if (!this.isInitialized) {
      return {
        success: false,
        error: {
          code: 'NOT_INITIALIZED',
          message: 'Research platform not initialized',
        },
      }
    }

    try {
      // Validate access
      const accessRequest = {
        userId,
        role: userRole,
        dataType: 'research-data',
        purpose: 'evidence-generation',
      }

      const accessResult = await this.hipaaService.validateAccess(accessRequest)
      if (!accessResult.granted) {
        return {
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied for evidence generation',
          },
        }
      }

      // Generate evidence
      const evidenceRequest = this.parseEvidenceRequest(request)
      if (!evidenceRequest) {
        return {
          success: false,
          error: {
            code: 'EVIDENCE_ERROR',
            message: 'Invalid evidence request format',
          },
        }
      }

      const report =
        await this.evidenceService.generateEvidence(evidenceRequest)

      return {
        success: true,
        data: report,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
          processingTime: 0,
        },
      }
    } catch (error: unknown) {
      return {
        success: false,
        error: {
          code: 'EVIDENCE_ERROR',
          message:
            error instanceof Error
              ? error instanceof Error
                ? error.message
                : 'Unknown error'
              : 'Unknown error',
        },
      }
    }
  }

  /**
   * Manage consent
   */
  async manageConsent(
    action: 'initialize' | 'update' | 'withdraw',
    clientId: string,
    data: unknown,
    _userId: string,
  ): Promise<ResearchAPIResponse> {
    if (!this.isInitialized) {
      return {
        success: false,
        error: {
          code: 'NOT_INITIALIZED',
          message: 'Research platform not initialized',
        },
      }
    }

    try {
      let result: unknown
      const consentData = this.toRecord(data)
      if (!consentData) {
        return {
          success: false,
          error: {
            code: 'CONSENT_ERROR',
            message: 'Invalid consent payload format',
          },
        }
      }

      const consentLevel = this.mapConsentLevel(
        this.asString(consentData['level']) ?? this.config.consent.defaultLevel,
      )
      const metadata =
        this.toRecord(consentData['metadata']) ??
        this.toRecord(consentData['metaData']) ??
        undefined
      const reason =
        typeof consentData['reason'] === 'string'
          ? consentData['reason']
          : undefined
      const immediate = this.toBoolean(consentData['immediate'])
      const update: ConsentUpdate = {
        clientId,
        newLevel: consentLevel,
        reason,
      }

      switch (action) {
        case 'initialize':
          result = await this.consentService.initializeConsent(
            clientId,
            consentLevel,
            metadata,
          )
          break
        case 'update':
          result = await this.consentService.updateConsent({
            clientId,
            newLevel: update.newLevel,
            reason: update.reason,
          })
          break
        case 'withdraw':
          try {
            result = await this.consentService.requestWithdrawal(
              clientId,
              reason,
              immediate,
            )
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : ''
            if (message.includes('No consent record found')) {
              const initialized = await this.consentService.initializeConsent(
                clientId,
                this.mapConsentLevel(
                  typeof consentData['level'] === 'string'
                    ? consentData['level']
                    : this.config.consent.defaultLevel,
                ),
                metadata,
              )
              void initialized

              result = await this.consentService.requestWithdrawal(
                clientId,
                reason,
                immediate,
              )
            } else {
              throw error
            }
          }
          break
        default:
          throw new Error(`Invalid consent action`)
      }

      return {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
          processingTime: 0,
        },
      }
    } catch (error: unknown) {
      return {
        success: false,
        error: {
          code: 'CONSENT_ERROR',
          message:
            error instanceof Error
              ? error instanceof Error
                ? error.message
                : 'Unknown error'
              : 'Unknown error',
        },
      }
    }
  }

  /**
   * Get audit trail
   */
  async getAuditTrail(
    userId?: string,
    dataType?: string,
    dateRange?: { start: Date; end: Date },
  ): Promise<ResearchAPIResponse> {
    if (!this.isInitialized) {
      return {
        success: false,
        error: {
          code: 'NOT_INITIALIZED',
          message: 'Research platform not initialized',
        },
      }
    }

    try {
      const auditTrail = await this.hipaaService.getAuditTrail(userId, dataType)
      const localTrail = this.platformAuditLog.filter((entry) => {
        if (userId && entry.userId !== userId) return false
        if (dataType && entry.dataType !== dataType) return false
        return true
      })

      const mergedTrail = [
        ...auditTrail,
        ...localTrail.map((entry) => ({
          action: entry.action,
          userId: entry.userId,
          dataType: entry.dataType,
          clientIds: entry.clientIds,
          timestamp: entry.timestamp,
          details: entry.details,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        })),
      ].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )

      // Filter by date range if provided
      let filtered = mergedTrail
      if (dateRange) {
        filtered = auditTrail.filter((log) => {
          const logDate = new Date(log.timestamp)
          return logDate >= dateRange.start && logDate <= dateRange.end
        })
      }

      return {
        success: true,
        data: filtered,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
          processingTime: 0,
        },
      }
    } catch (error: unknown) {
      return {
        success: false,
        error: {
          code: 'AUDIT_ERROR',
          message:
            error instanceof Error
              ? error instanceof Error
                ? error.message
                : 'Unknown error'
              : 'Unknown error',
        },
      }
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(): Promise<ResearchAPIResponse> {
    if (!this.isInitialized) {
      return {
        success: false,
        error: {
          code: 'NOT_INITIALIZED',
          message: 'Research platform not initialized',
        },
      }
    }

    try {
      const report = await this.hipaaService.generateComplianceReport()

      return {
        success: true,
        data: report,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
          processingTime: 0,
        },
      }
    } catch (error: unknown) {
      return {
        success: false,
        error: {
          code: 'COMPLIANCE_ERROR',
          message:
            error instanceof Error
              ? error instanceof Error
                ? error.message
                : 'Unknown error'
              : 'Unknown error',
        },
      }
    }
  }

  /**
   * Private methods
   */
  private async validateConfiguration(): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []
    const recommendations: string[] = []

    // Validate anonymization config
    if (this.config.anonymization.kAnonymity < 3) {
      errors.push('k-anonymity should be at least 3')
    }

    if (this.config.anonymization.differentialPrivacyEpsilon > 1.0) {
      warnings.push('High epsilon value may compromise privacy')
    }

    // Validate consent config
    if (this.config.consent.expirationDays < 30) {
      warnings.push('Short consent expiration may affect long-term studies')
    }

    // Validate HIPAA config
    if (!process.env['HIPAA_MASTER_KEY']) {
      errors.push('HIPAA master key not configured')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      recommendations,
    }
  }

  private toBoolean(value: unknown): boolean {
    return typeof value === 'boolean' ? value : false
  }

  private asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  private toRecord(value: unknown): Record<string, unknown> | undefined {
    return this.isRecord(value) ? value : undefined
  }

  private parseDate(value: unknown): Date | undefined {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value)
      if (!Number.isNaN(date.getTime())) {
        return date
      }
    }
    return undefined
  }

  private parseDateString(value: unknown): string | undefined {
    const date = this.parseDate(value)
    return date ? date.toISOString() : undefined
  }

  private toNumberRecord(value: unknown): Record<string, number> {
    const out: Record<string, number> = {}
    if (!this.isRecord(value)) return out
    for (const [key, v] of Object.entries(value)) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        out[key] = v
      }
    }
    return out
  }

  private normalizeResearchData(data: unknown[]): ResearchDataPoint[] {
    return data
      .map((entry) => this.parseResearchDataPoint(entry))
      .filter((entry): entry is ResearchDataPoint => entry !== undefined)
  }

  private extractClientIdsFromUnknownData(data: unknown[]): string[] {
    return this.normalizeResearchData(data).map((entry) => entry.clientId)
  }

  private parseResearchDataPoint(
    entry: unknown,
  ): ResearchDataPoint | undefined {
    if (!this.isRecord(entry)) return undefined

    const timestamp = this.parseDate(entry['timestamp'])
    const sessionDuration =
      typeof entry['sessionDuration'] === 'number'
        ? entry['sessionDuration']
        : undefined
    if (
      typeof entry['id'] !== 'string' ||
      typeof entry['clientId'] !== 'string' ||
      typeof entry['sessionId'] !== 'string' ||
      !timestamp ||
      typeof sessionDuration !== 'number'
    ) {
      return undefined
    }

    return {
      id: entry['id'],
      clientId: entry['clientId'],
      sessionId: entry['sessionId'],
      timestamp,
      emotionScores: this.toNumberRecord(entry['emotionScores']),
      techniqueEffectiveness: this.toNumberRecord(
        entry['techniqueEffectiveness'],
      ),
      sessionDuration,
      age: this.asString(entry['age']),
      gender: this.asString(entry['gender']),
      location: this.asString(entry['location']),
      therapeuticApproach: this.asString(entry['therapeuticApproach']),
      outcomeScore:
        typeof entry['outcomeScore'] === 'number'
          ? entry['outcomeScore']
          : undefined,
      metadata: this.toRecord(entry['metadata']),
    }
  }

  private parseResearchQuery(query: unknown): ResearchQuery | undefined {
    if (!this.isRecord(query)) return undefined

    const type = this.asString(query['type'])
    if (!type || !this.isResearchQueryType(type)) {
      return undefined
    }

    const anonymizationLevel = this.asString(query['anonymizationLevel'])
    if (!anonymizationLevel || !this.isAnonymizationLevel(anonymizationLevel)) {
      return undefined
    }

    return {
      id: this.asString(query['id']) ?? crypto.randomUUID(),
      type,
      sql: this.asString(query['sql']),
      parameters: this.toRecord(query['parameters']) ?? {},
      description: this.asString(query['description']) ?? '',
      context: this.asString(query['context']),
      expectedOutput: this.asString(query['expectedOutput']),
      requiresApproval: this.toBoolean(query['requiresApproval']),
      anonymizationLevel: anonymizationLevel,
      createdAt:
        this.parseDateString(query['createdAt']) ?? new Date().toISOString(),
      createdBy: this.asString(query['createdBy']) ?? 'system',
      approvedBy: this.asString(query['approvedBy']),
      approvedAt: this.parseDateString(query['approvedAt']),
    }
  }

  private isResearchQueryType(value: string): value is ResearchQuery['type'] {
    return (
      value === 'sql' ||
      value === 'pattern-discovery' ||
      value === 'longitudinal-analysis' ||
      value === 'cohort-comparison' ||
      value === 'aggregate-analysis'
    )
  }

  private isAnonymizationLevel(
    value: string,
  ): value is ResearchQuery['anonymizationLevel'] {
    return (
      value === 'none' ||
      value === 'low' ||
      value === 'medium' ||
      value === 'high'
    )
  }

  private parseDiscoveryRequest(
    request: unknown,
  ): DiscoveryRequest | undefined {
    if (!this.isRecord(request)) return undefined

    const patternTypes = request['patternTypes']
    if (!Array.isArray(patternTypes) || patternTypes.length === 0)
      return undefined
    const parsedPatternTypes = patternTypes
      .map((type) => this.asString(type))
      .filter(
        (type): type is 'correlation' | 'trend' | 'anomaly' | 'cluster' =>
          type === 'correlation' ||
          type === 'trend' ||
          type === 'anomaly' ||
          type === 'cluster',
      )

    const metrics = request['metrics']
    if (!Array.isArray(metrics) || metrics.length === 0) return undefined
    const parsedMetrics = metrics.flatMap((metric) => {
      const parsed = this.asString(metric)
      return parsed === undefined ? [] : [parsed]
    })

    const timeRange = request['timeRange']
    if (!this.isRecord(timeRange)) return undefined
    const start = this.parseDate(timeRange['start'])
    const end = this.parseDate(timeRange['end'])
    if (!start || !end) return undefined

    if (parsedPatternTypes.length === 0 || parsedMetrics.length === 0)
      return undefined

    return {
      patternTypes: parsedPatternTypes,
      metrics: parsedMetrics,
      timeRange: { start, end },
      demographicFilters: this.toRecord(request['demographicFilters']),
      techniqueFilters: this.toRecord(request['techniqueFilters']),
    }
  }

  private parseHypothesis(value: unknown):
    | {
        id: string
        statement: string
        variables: string[]
        expectedDirection: 'positive' | 'negative' | 'neutral'
        nullHypothesis: string
        alternativeHypothesis: string
      }
    | undefined {
    if (!this.isRecord(value)) return undefined
    const id = this.asString(value['id'])
    const statement = this.asString(value['statement'])
    const nullHypothesis = this.asString(value['nullHypothesis'])
    const alternativeHypothesis = this.asString(value['alternativeHypothesis'])
    const variables = value['variables']
    if (
      !id ||
      !statement ||
      !Array.isArray(variables) ||
      variables.length === 0 ||
      !nullHypothesis ||
      !alternativeHypothesis
    ) {
      return undefined
    }

    const parsedVariables = variables.flatMap((v) => {
      const parsed = this.asString(v)
      return parsed === undefined ? [] : [parsed]
    })
    if (parsedVariables.length === 0) return undefined

    const expectedDirection = this.asString(value['expectedDirection'])
    if (
      expectedDirection !== 'positive' &&
      expectedDirection !== 'negative' &&
      expectedDirection !== 'neutral'
    ) {
      return undefined
    }

    return {
      id,
      statement,
      variables: parsedVariables,
      expectedDirection,
      nullHypothesis,
      alternativeHypothesis,
    }
  }

  private parseEvidenceRequest(request: unknown): EvidenceRequest | undefined {
    if (!this.isRecord(request)) return undefined
    const hypotheses = request['hypotheses']
    if (!Array.isArray(hypotheses) || hypotheses.length === 0) return undefined

    const parsedHypotheses = hypotheses
      .map((hypothesis) => this.parseHypothesis(hypothesis))
      .filter(
        (hypothesis): hypothesis is EvidenceRequest['hypotheses'][number] =>
          hypothesis !== undefined,
      )

    if (parsedHypotheses.length === 0) return undefined

    return {
      hypotheses: parsedHypotheses,
      dataFilters: this.toRecord(request['dataFilters']),
      timeRange: this.isRecord(request['timeRange'])
        ? {
            start: this.parseDate(request['timeRange']['start']) ?? new Date(0),
            end: this.parseDate(request['timeRange']['end']) ?? new Date(0),
          }
        : undefined,
      demographicFilters: this.toRecord(request['demographicFilters']),
      techniqueFilters: this.toRecord(request['techniqueFilters']),
    }
  }

  private mapConsentLevelForAnonymization(
    level: string,
  ): 'minimal' | 'limited' | 'full' {
    const mapped = this.mapConsentLevel(level)
    return mapped === 'none' ? 'minimal' : mapped
  }

  private mapConsentLevel(level: string): ConsentLevel {
    if (
      level === 'none' ||
      level === 'minimal' ||
      level === 'limited' ||
      level === 'full'
    ) {
      return level
    }

    if (level === 'high') return 'full'
    return 'minimal'
  }

  private recordAudit(entry: AuditLog): void {
    this.platformAuditLog.push(entry)

    const retentionCutoff = new Date()
    retentionCutoff.setDate(
      retentionCutoff.getDate() - this.config.hipaa.auditRetentionDays,
    )

    this.platformAuditLog = this.platformAuditLog.filter(
      (log) => new Date(log.timestamp) >= retentionCutoff,
    )
  }

  private async initializeServices(): Promise<void> {
    // Initialize encryption keys
    if (!process.env['HIPAA_MASTER_KEY']) {
      logger.warn('HIPAA master key not found, using default')
    }

    // Test service connections
    await this.performHealthCheck()
  }

  private async performHealthCheck(): Promise<{
    healthy: boolean
    services: {
      anonymization: boolean
      consent: boolean
      hipaa: boolean
      queryEngine: boolean
      patternDiscovery: boolean
      evidenceGeneration: boolean
    }
  }> {
    const services = {
      anonymization: true,
      consent: true,
      hipaa: true,
      queryEngine: true,
      patternDiscovery: true,
      evidenceGeneration: true,
    }

    // Check each service
    try {
      await this.anonymizationService.validateAnonymization([])
    } catch {
      services.anonymization = false
    }

    try {
      await this.consentService.getConsentStatistics()
    } catch {
      services.consent = false
    }

    try {
      await this.hipaaService.generateComplianceReport()
    } catch {
      services.hipaa = false
    }

    const healthy = Object.values(services).every((status) => status)

    return { healthy, services }
  }

  private async collectMetrics(): Promise<SystemMetrics> {
    const now = new Date()

    // Collect metrics from services
    const consentStats = await this.consentService.getConsentStatistics()

    return {
      timestamp: now.toISOString(),
      activeQueries: 0, // Would track active queries
      cacheHitRate: 0.85, // Mock value
      averageQueryTime: 250, // Mock value in ms
      errorRate: 0.02, // Mock value
      dataVolume: {
        totalRecords: 10000, // Mock value
        anonymizedRecords: 9500, // Mock value
        encryptedRecords: 10000, // Mock value
      },
      consentMetrics: consentStats,
    }
  }
}

// Export singleton instance
export const researchPlatform = new ResearchPlatform()
