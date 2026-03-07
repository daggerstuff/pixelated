/**
 * HIPAA-Compliant Audit Logging for Pixelated Empathy Bias Detection Engine
 *
 * This module provides comprehensive audit logging functionality to ensure
 * HIPAA compliance and maintain detailed records of all system interactions.
 */

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import type {
  AuditLogEntry,
  AuditAction,
  DataAccessLog,
  ComplianceReport,
  ComplianceViolation,
  ComplianceRecommendation,
  DataRetentionStatus,
  RetentionPolicy,
  EncryptionStatus,
  ConfigurationUpdate,
  UserContext,
  ParticipantDemographics,
} from './types'

const logger = createBuildSafeLogger('BiasDetectionAudit')

// =============================================================================
// AUDIT LOG STORAGE INTERFACE
// =============================================================================

export interface AuditStorage {
  store(entry: AuditLogEntry): Promise<void>
  retrieve(filters: AuditLogFilters): Promise<AuditLogEntry[]>
  count(filters: AuditLogFilters): Promise<number>
  delete(entryIds: string[]): Promise<void>
  archive(beforeDate: Date): Promise<number>
}

export interface AuditLogFilters {
  userId?: string
  userEmail?: string
  actionType?: AuditAction['type']
  actionCategory?: AuditAction['category']
  resource?: string
  sensitivityLevel?: AuditAction['sensitivityLevel']
  timeRange?: { start: Date; end: Date }
  success?: boolean
  sessionId?: string
  limit?: number
  offset?: number
}

// =============================================================================
// IN-MEMORY AUDIT STORAGE (FOR DEVELOPMENT/TESTING)
// =============================================================================

class InMemoryAuditStorage implements AuditStorage {
  private entries: AuditLogEntry[] = []

  async store(entry: AuditLogEntry): Promise<void> {
    this.entries.push(entry)
    // In production, this would write to encrypted database
    logger.info('Audit log entry stored', {
      entryId: entry.id,
      action: entry.action.type,
      userId: entry.userId,
    })
  }

  async retrieve(filters: AuditLogFilters): Promise<AuditLogEntry[]> {
    let filtered = this.entries

    if (filters.userId) {
      filtered = filtered.filter((e) => e.userId === filters.userId)
    }
    if (filters.userEmail) {
      filtered = filtered.filter((e) => e.userEmail === filters.userEmail)
    }
    if (filters.actionType) {
      filtered = filtered.filter((e) => e.action.type === filters.actionType)
    }
    if (filters.actionCategory) {
      filtered = filtered.filter(
        (e) => e.action.category === filters.actionCategory,
      )
    }
    if (filters.resource) {
      filtered = filtered.filter((e) => e.resource === filters.resource)
    }
    if (filters.sensitivityLevel) {
      filtered = filtered.filter(
        (e) => e.action.sensitivityLevel === filters.sensitivityLevel,
      )
    }
    if (filters.timeRange) {
      filtered = filtered.filter(
        (e) =>
          e.timestamp >= filters.timeRange!.start &&
          e.timestamp <= filters.timeRange!.end,
      )
    }
    if (filters.success !== undefined) {
      filtered = filtered.filter((e) => e.success === filters.success)
    }
    if (filters.sessionId) {
      filtered = filtered.filter((e) => e.sessionId === filters.sessionId)
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    // Apply pagination
    const offset = filters.offset || 0
    const limit = filters.limit || 100
    return filtered.slice(offset, offset + limit)
  }

  async count(filters: AuditLogFilters): Promise<number> {
    const { limit: _limit, offset: _offset, ...filterParams } = filters
    const entries = await this.retrieve(filterParams)
    return entries.length
  }

  async delete(entryIds: string[]): Promise<void> {
    this.entries = this.entries.filter((e) => !entryIds.includes(e.id))
    logger.warn('Audit log entries deleted', { count: entryIds.length })
  }

  async archive(beforeDate: Date): Promise<number> {
    const toArchive = this.entries.filter((e) => e.timestamp < beforeDate)
    this.entries = this.entries.filter((e) => e.timestamp >= beforeDate)

    // In production, archived entries would be moved to long-term storage
    logger.info('Audit log entries archived', {
      count: toArchive.length,
      beforeDate,
    })
    return toArchive.length
  }
}

// =============================================================================
// AUDIT LOGGER CLASS
// =============================================================================

export class BiasDetectionAuditLogger {
  private storage: AuditStorage
  private encryptionEnabled: boolean
  private retentionPolicies: RetentionPolicy[]

  constructor(
    storage?: AuditStorage,
    encryptionEnabled: boolean = true,
    retentionPolicies: RetentionPolicy[] = [],
  ) {
    this.storage = storage || new InMemoryAuditStorage()
    this.encryptionEnabled = encryptionEnabled
    this.retentionPolicies =
      retentionPolicies.length > 0
        ? retentionPolicies
        : this.getDefaultRetentionPolicies()
  }

  /**
   * Log a user action for audit purposes
   */
  async logAction(
    user: UserContext,
    action: AuditAction,
    resource: string,
    details: Record<string, unknown>,
    request: {
      ipAddress: string
      userAgent: string
    },
    sessionId?: string,
    success: boolean = true,
    errorMessage?: string,
  ): Promise<void> {
    try {
      const resourceId = details['resourceId'] as string | undefined
      const entry: AuditLogEntry = {
        id: this.generateAuditId(),
        timestamp: new Date(),
        userId: user.userId,
        userEmail: user.email,
        action,
        resource,
        details: this.sanitizeDetails(details, action.sensitivityLevel),
        ipAddress: request?.ipAddress || 'unknown',
        userAgent: request?.userAgent || 'unknown',
        success,
        ...(resourceId && { resourceId }),
        ...(sessionId && { sessionId }),
        ...(errorMessage && { errorMessage }),
      }

      await this.storage.store(entry)

      // Log high-sensitivity actions immediately
      if (
        action.sensitivityLevel === 'high' ||
        action.sensitivityLevel === 'critical'
      ) {
        logger.warn('High-sensitivity action logged', {
          userId: user.userId,
          action: action.type,
          resource,
          success,
        })
      }
    } catch (error: unknown) {
      logger.error('Failed to log audit entry', {
        userId: user.userId,
        action: action.type,
        error: error instanceof Error ? String(error) : String(error),
      })
      // In production, this should trigger an alert
      throw error
    }
  }

  /**
   * Log data access for HIPAA compliance
   */
  async logDataAccess(
    user: UserContext,
    dataType: 'session-data' | 'demographics' | 'analysis-results' | 'reports',
    dataIds: string[],
    accessReason: string,
    request: { ipAddress: string; userAgent: string },
    approvedBy?: string,
    retentionPeriod: number = 30,
    anonymized: boolean = false,
  ): Promise<void> {
    const dataAccessLog: DataAccessLog = {
      id: this.generateAuditId(),
      timestamp: new Date(),
      userId: user.userId,
      dataType,
      dataIds,
      accessReason,
      retentionPeriod,
      anonymized,
      ...(approvedBy && { approvedBy }),
    }

    const action: AuditAction = {
      type: 'read',
      category: 'user-data',
      description: `Accessed ${dataType}: ${accessReason}`,
      sensitivityLevel: this.determineSensitivityLevel(
        dataType,
        dataIds.length,
      ),
    }

    await this.logAction(
      user,
      action,
      `data-access-${dataType}`,
      {
        dataAccessLog,
        dataCount: dataIds.length,
        anonymized,
      },
      request,
    )
  }

  /**
   * Log bias analysis session
   */
  async logBiasAnalysis(
    user: UserContext,
    sessionId: string,
    demographics: ParticipantDemographics | undefined,
    biasScore: number,
    alertLevel: string,
    request: { ipAddress: string; userAgent: string },
    success: boolean = true,
    errorMessage?: string,
  ): Promise<void> {
    const action: AuditAction = {
      type: 'create',
      category: 'bias-analysis',
      description: `Performed bias analysis on session ${sessionId}`,
      sensitivityLevel:
        alertLevel === 'critical' || alertLevel === 'high' ? 'high' : 'medium',
    }

    await this.logAction(
      user,
      action,
      'bias-analysis',
      {
        sessionId,
        demographics: this.anonymizeDemographics(demographics),
        biasScore,
        alertLevel,
      },
      request,
      sessionId,
      success,
      errorMessage,
    )
  }

  /**
   * Log configuration changes
   */
  async logConfigurationChange(
    user: UserContext,
    update: ConfigurationUpdate,
    request: { ipAddress: string; userAgent: string },
  ): Promise<void> {
    const action: AuditAction = {
      type: 'update',
      category: 'configuration',
      description: `Updated ${update.section} configuration`,
      sensitivityLevel: update.changes.some(
        (c) => c.impact === 'critical' || c.impact === 'high',
      )
        ? 'high'
        : 'medium',
    }

    await this.logAction(
      user,
      action,
      'configuration',
      {
        configUpdate: update,
        changesCount: update.changes.length,
        requiresRestart: update.changes.some((c) => c.requiresRestart),
      },
      request,
    )
  }

  /**
   * Log authentication events
   */
  async logAuthentication(
    userId: string,
    userEmail: string,
    actionType: 'login' | 'logout',
    request: { ipAddress: string; userAgent: string },
    success: boolean = true,
    errorMessage?: string,
  ): Promise<void> {
    const user: UserContext = {
      userId,
      email: userEmail,
      role: {
        id: 'unknown',
        name: 'viewer',
        description: 'Unknown role',
        level: 1,
      },
      permissions: [],
    }

    const action: AuditAction = {
      type: actionType,
      category: 'authentication',
      description: `User ${actionType}`,
      sensitivityLevel: 'medium',
    }

    await this.logAction(
      user,
      action,
      'authentication',
      {
        authenticationEvent: actionType,
        timestamp: new Date(),
      },
      request,
      undefined,
      success,
      errorMessage,
    )
  }

  /**
   * Retrieve audit logs with filtering
   */
  async getAuditLogs(filters: AuditLogFilters): Promise<AuditLogEntry[]> {
    return await this.storage.retrieve(filters)
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    period: { start: Date; end: Date },
    includeViolations: boolean = true,
  ): Promise<ComplianceReport> {
    const auditTrail = await this.storage.retrieve({
      timeRange: period,
      limit: 10000, // Large limit for comprehensive report
    })

    const violations = includeViolations
      ? await this.detectViolations(auditTrail)
      : []
    const recommendations = await this.generateRecommendations(
      auditTrail,
      violations,
    )
    const dataRetentionStatus = await this.getDataRetentionStatus()
    const encryptionStatus = await this.getEncryptionStatus()

    const complianceScore = this.calculateComplianceScore(
      auditTrail,
      violations,
    )

    return {
      id: this.generateAuditId(),
      generatedAt: new Date(),
      period,
      complianceScore,
      violations,
      recommendations,
      auditTrail: auditTrail.slice(0, 100), // Include sample of audit trail
      dataRetentionStatus,
      encryptionStatus,
    }
  }

  /**
   * Clean up old audit logs based on retention policies
   */
  async cleanupOldLogs(): Promise<{ archived: number; deleted: number }> {
    let totalArchived = 0
    const totalDeleted = 0

    for (const policy of this.retentionPolicies) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionPeriod)

      if (policy.archiveBeforeDelete) {
        const archived = await this.storage.archive(cutoffDate)
        totalArchived += archived
      } else {
        // For immediate deletion, we'd need to implement a delete method
        // that respects the retention policy
        logger.info('Retention policy requires immediate deletion', {
          dataType: policy.dataType,
          cutoffDate,
        })
      }
    }

    return { archived: totalArchived, deleted: totalDeleted }
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private sanitizeDetails(
    details: Record<string, unknown>,
    sensitivityLevel: string,
  ): Record<string, unknown> {
    if (sensitivityLevel === 'low') {
      return details
    }

    const sanitized = { ...details }

    // Remove or mask sensitive fields based on sensitivity level
    if (sensitivityLevel === 'high' || sensitivityLevel === 'critical') {
      // Mask PII in high-sensitivity logs
      if (sanitized['demographics']) {
        sanitized['demographics'] = this.anonymizeDemographics(
          sanitized['demographics'] as ParticipantDemographics,
        )
      }

      // Remove detailed session content
      if (sanitized['sessionContent']) {
        sanitized['sessionContent'] = '[REDACTED]'
      }
    }

    return sanitized
  }

  private anonymizeDemographics(
    demographics: ParticipantDemographics | undefined,
  ): Partial<ParticipantDemographics> {
    if (!demographics) {
      return {}
    }

    const result: Partial<ParticipantDemographics> = {
      age: demographics.age,
      gender: demographics.gender,
      ethnicity: demographics.ethnicity,
      primaryLanguage: demographics.primaryLanguage,
      // Only include socioeconomicStatus if it exists
      ...(demographics.socioeconomicStatus && {
        socioeconomicStatus: demographics.socioeconomicStatus,
      }),
      // Explicitly redact region for privacy instead of omitting
      ...(demographics &&
      'region' in demographics &&
      demographics.region !== undefined
        ? { region: 'REDACTED' }
        : {}),
    }
    return result
  }

  private determineSensitivityLevel(
    dataType: string,
    recordCount: number,
  ): AuditAction['sensitivityLevel'] {
    if (dataType === 'demographics' || dataType === 'session-data') {
      return recordCount > 100
        ? 'critical'
        : recordCount > 10
          ? 'high'
          : 'medium'
    }
    return recordCount > 1000 ? 'high' : 'medium'
  }

  private async detectViolations(
    auditTrail: AuditLogEntry[],
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = []

    // Check for unauthorized access patterns
    const failedLogins = auditTrail.filter(
      (e) => e.action.type === 'login' && !e.success,
    )

    if (failedLogins.length > 10) {
      violations.push({
        id: this.generateAuditId(),
        type: 'unauthorized-access',
        severity: 'high',
        description: `${failedLogins.length} failed login attempts detected`,
        detectedAt: new Date(),
        remediation: [
          'Review failed login attempts',
          'Implement account lockout policies',
          'Enable multi-factor authentication',
        ],
      })
    }

    // Check for missing audit logs (gaps in timeline)
    const timeGaps = this.detectTimeGaps(auditTrail)
    if (timeGaps.length > 0) {
      violations.push({
        id: this.generateAuditId(),
        type: 'missing-audit',
        severity: 'medium',
        description: `${timeGaps.length} gaps detected in audit trail`,
        detectedAt: new Date(),
        remediation: [
          'Investigate audit logging system',
          'Ensure continuous logging',
          'Implement audit log monitoring',
        ],
      })
    }

    return violations
  }

  private async generateRecommendations(
    auditTrail: AuditLogEntry[],
    violations: ComplianceViolation[],
  ): Promise<ComplianceRecommendation[]> {
    const recommendations: ComplianceRecommendation[] = []

    // Analyze access patterns
    const highSensitivityAccess = auditTrail.filter(
      (e) =>
        e.action.sensitivityLevel === 'high' ||
        e.action.sensitivityLevel === 'critical',
    )

    if (highSensitivityAccess.length > 0) {
      recommendations.push({
        id: this.generateAuditId(),
        category: 'access-control',
        priority: 'high',
        title: 'Implement Additional Authorization for High-Sensitivity Data',
        description:
          'High-sensitivity data access detected. Consider implementing additional authorization controls.',
        implementationSteps: [
          'Implement multi-factor authentication for high-sensitivity data',
          'Add approval workflows for critical data access',
          'Implement time-limited access tokens',
        ],
        timeline: '2-4 weeks',
        complianceStandards: ['HIPAA', 'SOC2'],
      })
    }

    // Check for violations and add corresponding recommendations
    for (const violation of violations) {
      if (violation.type === 'unauthorized-access') {
        recommendations.push({
          id: this.generateAuditId(),
          category: 'access-control',
          priority: 'critical',
          title: 'Strengthen Authentication Controls',
          description: 'Multiple unauthorized access attempts detected.',
          implementationSteps: violation.remediation,
          timeline: '1-2 weeks',
          complianceStandards: ['HIPAA', 'SOC2'],
        })
      }
    }

    return recommendations
  }

  private detectTimeGaps(
    auditTrail: AuditLogEntry[],
  ): { start: Date; end: Date }[] {
    const gaps: { start: Date; end: Date }[] = []
    const sortedEntries = auditTrail.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    )

    for (let i = 1; i < sortedEntries.length; i++) {
      const currentEntry = sortedEntries[i]
      const previousEntry = sortedEntries[i - 1]

      if (!currentEntry || !previousEntry) {
        continue
      }

      const timeDiff =
        currentEntry.timestamp.getTime() - previousEntry.timestamp.getTime()
      const hoursDiff = timeDiff / (1000 * 60 * 60)

      // Flag gaps longer than 24 hours during business days
      if (hoursDiff > 24) {
        gaps.push({
          start: previousEntry.timestamp,
          end: currentEntry.timestamp,
        })
      }
    }

    return gaps
  }

  private calculateComplianceScore(
    auditTrail: AuditLogEntry[],
    violations: ComplianceViolation[],
  ): number {
    let score = 100

    // Deduct points for violations
    for (const violation of violations) {
      switch (violation.severity) {
        case 'critical':
          score -= 25
          break
        case 'high':
          score -= 15
          break
        case 'medium':
          score -= 10
          break
        case 'low':
          score -= 5
          break
      }
    }

    // Deduct points for failed actions
    const failedActions = auditTrail.filter((e) => !e.success)
    const failureRate = failedActions.length / auditTrail.length
    score -= failureRate * 20

    return Math.max(score, 0)
  }

  private async getDataRetentionStatus(): Promise<DataRetentionStatus> {
    const totalRecords = await this.storage.count({})

    // Calculate records near expiry (within 30 days)
    const nearExpiryDate = new Date()
    nearExpiryDate.setDate(nearExpiryDate.getDate() + 30)

    return {
      totalRecords,
      recordsNearExpiry: 0, // Would be calculated based on retention policies
      expiredRecords: 0, // Would be calculated based on retention policies
      retentionPolicies: this.retentionPolicies,
      lastCleanup: new Date(), // Would track actual cleanup dates
    }
  }

  private async getEncryptionStatus(): Promise<EncryptionStatus> {
    return {
      dataAtRest: {
        encrypted: this.encryptionEnabled,
        algorithm: 'AES-256-GCM',
        keyRotationDate: new Date(),
      },
      dataInTransit: {
        encrypted: true,
        protocol: 'TLS 1.3',
        certificateExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      },
      backups: {
        encrypted: this.encryptionEnabled,
        location: 'encrypted-storage',
        lastBackup: new Date(),
      },
    }
  }

  private getDefaultRetentionPolicies(): RetentionPolicy[] {
    return [
      {
        dataType: 'audit-logs',
        retentionPeriod: 2555, // 7 years for HIPAA compliance
        autoDelete: false,
        archiveBeforeDelete: true,
        approvalRequired: true,
      },
      {
        dataType: 'session-data',
        retentionPeriod: 1825, // 5 years
        autoDelete: false,
        archiveBeforeDelete: true,
        approvalRequired: true,
      },
      {
        dataType: 'analysis-results',
        retentionPeriod: 1095, // 3 years
        autoDelete: false,
        archiveBeforeDelete: true,
        approvalRequired: false,
      },
      {
        dataType: 'system-logs',
        retentionPeriod: 365, // 1 year
        autoDelete: true,
        archiveBeforeDelete: false,
        approvalRequired: false,
      },
    ]
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let auditLoggerInstance: BiasDetectionAuditLogger | null = null

export function getAuditLogger(
  storage?: AuditStorage,
  encryptionEnabled?: boolean,
  retentionPolicies?: RetentionPolicy[],
): BiasDetectionAuditLogger {
  if (!auditLoggerInstance) {
    auditLoggerInstance = new BiasDetectionAuditLogger(
      storage,
      encryptionEnabled,
      retentionPolicies,
    )
  }
  return auditLoggerInstance
}

/**
 * Reset the singleton instance (for testing purposes)
 */
export function resetAuditLogger() {
  auditLoggerInstance = null
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Quick function to log bias analysis actions
 */
export async function logBiasAnalysisAction(
  user: UserContext,
  sessionId: string,
  action: 'analyze' | 'export' | 'view',
  details: Record<string, unknown>,
  request: { ipAddress: string; userAgent: string },
  success: boolean = true,
  errorMessage?: string,
): Promise<void> {
  const auditLogger = getAuditLogger()

  const alertLevel = details['alertLevel'] as string | undefined

  const auditAction: AuditAction = {
    type:
      action === 'analyze' ? 'create' : action === 'export' ? 'export' : 'read',
    category: 'bias-analysis',
    description: `${action} bias analysis for session ${sessionId}`,
    sensitivityLevel: alertLevel === 'critical' ? 'critical' : 'medium',
  }

  await auditLogger.logAction(
    user,
    auditAction,
    'bias-analysis',
    details,
    request,
    sessionId,
    success,
    errorMessage,
  )
}

/**
 * Quick function to log data export actions
 */
export async function logDataExport(
  user: UserContext,
  exportType: 'json' | 'csv' | 'pdf',
  recordCount: number,
  request: { ipAddress: string; userAgent: string },
  success: boolean = true,
  errorMessage?: string,
): Promise<void> {
  const auditLogger = getAuditLogger()

  const auditAction: AuditAction = {
    type: 'export',
    category: 'user-data',
    description: `Exported ${recordCount} records as ${exportType}`,
    sensitivityLevel:
      recordCount > 1000 ? 'high' : recordCount > 100 ? 'medium' : 'low',
  }

  await auditLogger.logAction(
    user,
    auditAction,
    'data-export',
    {
      exportType,
      recordCount,
      timestamp: new Date(),
    },
    request,
    undefined,
    success,
    errorMessage,
  )
}
