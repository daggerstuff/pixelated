import { getLogger } from '@/lib/logging/logger'
import {
  ConsentRecord,
  ConsentLevel,
  ResearchConsent,
} from '@/lib/research/types/research-types'

const logger = getLogger('ConsentManagementService')

export interface ConsentConfig {
  defaultConsentLevel: ConsentLevel
  consentExpirationDays: number
  withdrawalGracePeriodHours: number
  auditRetentionDays: number
}

export interface ConsentUpdate {
  clientId: string
  newLevel: ConsentLevel
  reason?: string
  effectiveDate?: Date
}

export interface ConsentAuditLog {
  timestamp: string
  clientId: string
  operation: string
  oldLevel?: ConsentLevel
  newLevel?: ConsentLevel
  reason?: string
  ipAddress?: string
  userAgent?: string
}

export class ConsentManagementService {
  private config: ConsentConfig
  private consentStore: Map<string, ConsentRecord> = new Map()
  private auditLog: ConsentAuditLog[] = []

  constructor(
    config: ConsentConfig = {
      defaultConsentLevel: 'minimal',
      consentExpirationDays: 365,
      withdrawalGracePeriodHours: 24,
      auditRetentionDays: 2555, // 7 years for HIPAA compliance
    },
  ) {
    this.config = config
  }

  /**
   * Initialize consent for a new client
   */
  async initializeConsent(
    clientId: string,
    initialLevel: ConsentLevel = this.config.defaultConsentLevel,
    metadata?: {
      ipAddress?: string
      userAgent?: string
      consentFormVersion?: string
    },
  ): Promise<ConsentRecord> {
    logger.info('Initializing consent for client', { clientId, initialLevel })

    const consentRecord: ConsentRecord = {
      clientId,
      currentLevel: initialLevel,
      consentHistory: [
        {
          level: initialLevel,
          timestamp: new Date().toISOString(),
          reason: 'Initial consent',
          ipAddress: metadata?.ipAddress,
          userAgent: metadata?.userAgent,
          consentFormVersion: metadata?.consentFormVersion || '1.0',
        },
      ],
      lastUpdated: new Date().toISOString(),
      expirationDate: new Date(
        Date.now() + this.config.consentExpirationDays * 24 * 60 * 60 * 1000,
      ).toISOString(),
      withdrawalRequested: false,
      withdrawalDate: null,
      dataPurged: false,
    }

    this.consentStore.set(clientId, consentRecord)

    // Log the initialization
    this.logAudit({
      timestamp: new Date().toISOString(),
      clientId,
      operation: 'initialize',
      newLevel: initialLevel,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    })

    return consentRecord
  }

  /**
   * Update consent level for a client
   */
  async updateConsent(update: ConsentUpdate): Promise<ConsentRecord> {
    const { clientId, newLevel, reason, effectiveDate } = update

    logger.info('Updating consent for client', { clientId, newLevel, reason })

    const existingConsent = this.consentStore.get(clientId)
    if (!existingConsent) {
      throw new Error(`No consent record found for client: ${clientId}`)
    }

    const oldLevel = existingConsent.currentLevel

    // Create new consent record
    const updatedConsent: ConsentRecord = {
      ...existingConsent,
      currentLevel: newLevel,
      lastUpdated: (effectiveDate || new Date()).toISOString(),
      consentHistory: [
        ...existingConsent.consentHistory,
        {
          level: newLevel,
          timestamp: (effectiveDate || new Date()).toISOString(),
          reason: reason || 'User requested change',
          ipAddress: undefined, // Would be populated from request context
          userAgent: undefined, // Would be populated from request context
          consentFormVersion: '1.0',
        },
      ],
    }

    this.consentStore.set(clientId, updatedConsent)

    // Log the update
    this.logAudit({
      timestamp: new Date().toISOString(),
      clientId,
      operation: 'update',
      oldLevel,
      newLevel,
      reason,
    })

    return updatedConsent
  }

  /**
   * Request consent withdrawal
   */
  async requestWithdrawal(
    clientId: string,
    reason?: string,
    immediate: boolean = false,
  ): Promise<{
    consentRecord: ConsentRecord
    dataPurgeScheduled: boolean
    gracePeriodEnd: Date
  }> {
    logger.info('Processing consent withdrawal request', {
      clientId,
      immediate,
    })

    const consentRecord = this.consentStore.get(clientId)
    if (!consentRecord) {
      throw new Error(`No consent record found for client: ${clientId}`)
    }

    const withdrawalDate = new Date()
    const gracePeriodEnd = new Date(
      withdrawalDate.getTime() +
        this.config.withdrawalGracePeriodHours * 60 * 60 * 1000,
    )

    const updatedConsent: ConsentRecord = {
      ...consentRecord,
      withdrawalRequested: true,
      withdrawalDate: withdrawalDate.toISOString(),
      lastUpdated: withdrawalDate.toISOString(),
    }

    this.consentStore.set(clientId, updatedConsent)

    // Log the withdrawal request
    this.logAudit({
      timestamp: withdrawalDate.toISOString(),
      clientId,
      operation: 'withdrawal-request',
      reason,
    })

    return {
      consentRecord: updatedConsent,
      dataPurgeScheduled: !immediate,
      gracePeriodEnd,
    }
  }

  /**
   * Complete consent withdrawal and purge data
   */
  async completeWithdrawal(clientId: string): Promise<void> {
    logger.info('Completing consent withdrawal and data purge', { clientId })

    const consentRecord = this.consentStore.get(clientId)
    if (!consentRecord) {
      throw new Error(`No consent record found for client: ${clientId}`)
    }

    if (!consentRecord.withdrawalRequested) {
      throw new Error(`No withdrawal request found for client: ${clientId}`)
    }

    // Mark data as purged
    const updatedConsent: ConsentRecord = {
      ...consentRecord,
      dataPurged: true,
      lastUpdated: new Date().toISOString(),
    }

    this.consentStore.set(clientId, updatedConsent)

    // Log the completion
    this.logAudit({
      timestamp: new Date().toISOString(),
      clientId,
      operation: 'withdrawal-complete',
    })

    // In a real implementation, this would trigger actual data purging
    await this.purgeClientData(clientId)
  }

  /**
   * Get current consent level for a client
   */
  async getConsentLevel(clientId: string): Promise<ConsentLevel | null> {
    const consentRecord = this.consentStore.get(clientId)
    if (!consentRecord || consentRecord.withdrawalRequested) {
      return null
    }

    // Check if consent has expired
    if (new Date(consentRecord.expirationDate) < new Date()) {
      return null
    }

    return consentRecord.currentLevel
  }

  /**
   * Get detailed consent record
   */
  async getConsentRecord(clientId: string): Promise<ConsentRecord | null> {
    return this.consentStore.get(clientId) || null
  }

  /**
   * Check if client has given consent for specific research use
   */
  async hasConsentFor(
    clientId: string,
    researchUse: keyof ResearchConsent,
  ): Promise<boolean> {
    const consentLevel = await this.getConsentLevel(clientId)
    if (!consentLevel) return false

    const consentMapping: Record<ConsentLevel, Partial<ResearchConsent>> = {
      none: {},
      minimal: {
        aggregateAnalytics: true,
        anonymizedResearch: true,
      },
      limited: {
        aggregateAnalytics: true,
        anonymizedResearch: true,
        techniqueEffectiveness: true,
        outcomePrediction: true,
      },
      full: {
        aggregateAnalytics: true,
        anonymizedResearch: true,
        techniqueEffectiveness: true,
        outcomePrediction: true,
        patternDiscovery: true,
        predictiveModeling: true,
      },
    }

    const permissions = consentMapping[consentLevel]
    return permissions[researchUse] || false
  }

  /**
   * Get consent statistics
   */
  async getConsentStatistics(): Promise<{
    totalClients: number
    activeConsents: number
    consentLevels: Record<ConsentLevel, number>
    withdrawalRequests: number
    expiredConsents: number
  }> {
    const records = Array.from(this.consentStore.values())
    const now = new Date()

    const stats = {
      totalClients: records.length,
      activeConsents: records.filter(
        (r) => !r.withdrawalRequested && new Date(r.expirationDate) > now,
      ).length,
      consentLevels: {
        none: 0,
        minimal: 0,
        limited: 0,
        full: 0,
      },
      withdrawalRequests: records.filter((r) => r.withdrawalRequested).length,
      expiredConsents: records.filter((r) => new Date(r.expirationDate) <= now)
        .length,
    }

    records.forEach((record) => {
      if (
        !record.withdrawalRequested &&
        new Date(record.expirationDate) > now
      ) {
        stats.consentLevels[record.currentLevel]++
      }
    })

    return stats
  }

  /**
   * Validate consent for research data access
   */
  async validateResearchAccess(
    clientIds: string[],
    researchUse: keyof ResearchConsent,
  ): Promise<{
    validClients: string[]
    invalidClients: string[]
    consentIssues: Array<{
      clientId: string
      issue: string
    }>
  }> {
    const validClients: string[] = []
    const invalidClients: string[] = []
    const consentIssues: Array<{ clientId: string; issue: string }> = []

    for (const clientId of clientIds) {
      const hasConsent = await this.hasConsentFor(clientId, researchUse)

      if (hasConsent) {
        validClients.push(clientId)
      } else {
        invalidClients.push(clientId)

        const consentRecord = await this.getConsentRecord(clientId)
        if (!consentRecord) {
          consentIssues.push({ clientId, issue: 'No consent record found' })
        } else if (consentRecord.withdrawalRequested) {
          consentIssues.push({
            clientId,
            issue: 'Consent withdrawal requested',
          })
        } else if (new Date(consentRecord.expirationDate) <= new Date()) {
          consentIssues.push({ clientId, issue: 'Consent has expired' })
        } else {
          consentIssues.push({
            clientId,
            issue: `Insufficient consent level: ${consentRecord.currentLevel}`,
          })
        }
      }
    }

    return { validClients, invalidClients, consentIssues }
  }

  /**
   * Get audit trail for a client
   */
  async getAuditTrail(clientId?: string): Promise<ConsentAuditLog[]> {
    if (clientId) {
      return this.auditLog.filter((log) => log.clientId === clientId)
    }
    return [...this.auditLog]
  }

  /**
   * Export consent data for compliance reporting
   */
  async exportConsentData(): Promise<{
    consentRecords: ConsentRecord[]
    auditLog: ConsentAuditLog[]
    statistics: {
      totalClients: number
      activeConsents: number
      consentLevels: Record<ConsentLevel, number>
      withdrawalRequests: number
      expiredConsents: number
    }
  }> {
    return {
      consentRecords: Array.from(this.consentStore.values()),
      auditLog: this.auditLog,
      statistics: await this.getConsentStatistics(),
    }
  }

  /**
   * Private methods
   */
  private logAudit(logEntry: ConsentAuditLog): void {
    this.auditLog.push(logEntry)

    // Trim audit log to retention period
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.config.auditRetentionDays)

    this.auditLog = this.auditLog.filter(
      (log) => new Date(log.timestamp) >= cutoffDate,
    )
  }

  private async purgeClientData(clientId: string): Promise<void> {
    // In a real implementation, this would:
    // 1. Remove all research data for the client
    // 2. Update anonymization records
    // 3. Notify downstream systems
    // 4. Generate purge confirmation

    logger.info('Client data purged', { clientId })
  }
}
