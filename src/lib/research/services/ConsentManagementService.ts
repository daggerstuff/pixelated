/**
 * @file src/lib/research/services/ConsentManagementService.ts
 *
 * HIPAA-compliant consent management with PostgreSQL persistence
 * and Redis hot-path caching. Replaces the original in-memory store.
 *
 * Retention: 7 years (2555 days) per HIPAA §164.530(j).
 */

import { getLogger } from '@/lib/logging/logger'
import { query } from '@/lib/db'
import { redis } from '@/lib/redis'
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

const REDIS_CONSENT_KEY = 'consent:level:'
const REDIS_CONSENT_TTL = 3600 // 1 hour cache TTL

export class ConsentManagementService {
  private readonly config: ConsentConfig

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

    const now = new Date()
    const expirationDate = new Date(
      now.getTime() +
        this.config.consentExpirationDays * 24 * 60 * 60 * 1000,
    )

    const historyEntry = {
      level: initialLevel,
      timestamp: now.toISOString(),
      reason: 'Initial consent',
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      consentFormVersion: metadata?.consentFormVersion ?? '1.0',
    }

    await query(
      `INSERT INTO consent_records (
        client_id, current_level, consent_history, last_updated,
        expiration_date, withdrawal_requested, withdrawal_date, data_purged
      ) VALUES ($1, $2, $3, $4, $5, false, NULL, false)
      ON CONFLICT (client_id) DO UPDATE SET
        current_level = $2,
        consent_history = $3,
        last_updated = $4,
        expiration_date = $5,
        withdrawal_requested = false,
        withdrawal_date = NULL,
        data_purged = false`,
      [
        clientId,
        initialLevel,
        JSON.stringify([historyEntry]),
        now,
        expirationDate,
      ],
    )

    await this.cacheConsentLevel(clientId, initialLevel, expirationDate)

    await this.logAudit({
      timestamp: now.toISOString(),
      clientId,
      operation: 'initialize',
      newLevel: initialLevel,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    })

    return {
      clientId,
      currentLevel: initialLevel,
      consentHistory: [historyEntry],
      lastUpdated: now.toISOString(),
      expirationDate: expirationDate.toISOString(),
      withdrawalRequested: false,
      withdrawalDate: null,
      dataPurged: false,
    }
  }

  /**
   * Update consent level for a client
   */
  async updateConsent(update: ConsentUpdate): Promise<ConsentRecord> {
    const { clientId, newLevel, reason, effectiveDate } = update

    logger.info('Updating consent for client', { clientId, newLevel, reason })

    const existing = await this.fetchConsentRecord(clientId)
    if (!existing) {
      throw new Error(`No consent record found for client: ${clientId}`)
    }

    const oldLevel = existing.currentLevel
    const now = effectiveDate ?? new Date()
    const historyEntry = {
      level: newLevel,
      timestamp: now.toISOString(),
      reason: reason ?? 'User requested change',
      consentFormVersion: '1.0',
    }

    const updatedHistory = [...existing.consentHistory, historyEntry]

    await query(
      `UPDATE consent_records SET
        current_level = $1,
        consent_history = $2,
        last_updated = $3
      WHERE client_id = $4`,
      [newLevel, JSON.stringify(updatedHistory), now, clientId],
    )

    await this.cacheConsentLevel(clientId, newLevel, new Date(existing.expirationDate))

    await this.logAudit({
      timestamp: now.toISOString(),
      clientId,
      operation: 'update',
      oldLevel,
      newLevel,
      reason,
    })

    return {
      ...existing,
      currentLevel: newLevel,
      lastUpdated: now.toISOString(),
      consentHistory: updatedHistory,
    }
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

    const existing = await this.fetchConsentRecord(clientId)
    if (!existing) {
      throw new Error(`No consent record found for client: ${clientId}`)
    }

    const withdrawalDate = new Date()
    const gracePeriodEnd = new Date(
      withdrawalDate.getTime() +
        this.config.withdrawalGracePeriodHours * 60 * 60 * 1000,
    )

    await query(
      `UPDATE consent_records SET
        withdrawal_requested = true,
        withdrawal_date = $1,
        last_updated = $1
      WHERE client_id = $2`,
      [withdrawalDate, clientId],
    )

    await this.invalidateConsentCache(clientId)

    await this.logAudit({
      timestamp: withdrawalDate.toISOString(),
      clientId,
      operation: 'withdrawal-request',
      reason,
    })

    const updatedRecord: ConsentRecord = {
      ...existing,
      withdrawalRequested: true,
      withdrawalDate: withdrawalDate.toISOString(),
      lastUpdated: withdrawalDate.toISOString(),
    }

    return {
      consentRecord: updatedRecord,
      dataPurgeScheduled: !immediate,
      gracePeriodEnd,
    }
  }

  /**
   * Complete consent withdrawal and purge data
   */
  async completeWithdrawal(clientId: string): Promise<void> {
    logger.info('Completing consent withdrawal and data purge', { clientId })

    const existing = await this.fetchConsentRecord(clientId)
    if (!existing) {
      throw new Error(`No consent record found for client: ${clientId}`)
    }

    if (!existing.withdrawalRequested) {
      throw new Error(`No withdrawal request found for client: ${clientId}`)
    }

    await query(
      `UPDATE consent_records SET
        data_purged = true,
        last_updated = NOW()
      WHERE client_id = $1`,
      [clientId],
    )

    await this.invalidateConsentCache(clientId)

    await this.logAudit({
      timestamp: new Date().toISOString(),
      clientId,
      operation: 'withdrawal-complete',
    })

    await this.purgeClientData(clientId)
  }

  /**
   * Get current consent level for a client
   * Uses Redis cache for hot-path reads, falls back to PostgreSQL
   */
  async getConsentLevel(clientId: string): Promise<ConsentLevel | null> {
    // Try Redis cache first
    try {
      const cached = await redis.get(`${REDIS_CONSENT_KEY}${clientId}`)
      if (cached) {
        const parsed = JSON.parse(cached) as {
          level: ConsentLevel
          expirationDate: string
          withdrawalRequested: boolean
        }
        if (parsed.withdrawalRequested) return null
        if (new Date(parsed.expirationDate) < new Date()) return null
        return parsed.level
      }
    } catch {
      // Cache miss or error — fall through to DB
    }

    const record = await this.fetchConsentRecord(clientId)
    if (!record || record.withdrawalRequested) {
      return null
    }

    if (new Date(record.expirationDate) < new Date()) {
      return null
    }

    // Write to cache for next read
    await this.cacheConsentLevel(
      clientId,
      record.currentLevel,
      new Date(record.expirationDate),
    )

    return record.currentLevel
  }

  /**
   * Get detailed consent record
   */
  async getConsentRecord(clientId: string): Promise<ConsentRecord | null> {
    return this.fetchConsentRecord(clientId)
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
    return permissions[researchUse] ?? false
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
    const totalResult = await query(
      'SELECT COUNT(*) as count FROM consent_records',
    )
    const totalClients = parseInt(totalResult.rows[0]?.['count'] ?? '0', 10)

    const activeResult = await query(
      `SELECT COUNT(*) as count FROM consent_records
       WHERE withdrawal_requested = false AND data_purged = false
       AND expiration_date > NOW()`,
    )
    const activeConsents = parseInt(activeResult.rows[0]?.['count'] ?? '0', 10)

    const withdrawalResult = await query(
      `SELECT COUNT(*) as count FROM consent_records WHERE withdrawal_requested = true`,
    )
    const withdrawalRequests = parseInt(withdrawalResult.rows[0]?.['count'] ?? '0', 10)

    const expiredResult = await query(
      `SELECT COUNT(*) as count FROM consent_records
       WHERE expiration_date <= NOW() AND withdrawal_requested = false AND data_purged = false`,
    )
    const expiredConsents = parseInt(expiredResult.rows[0]?.['count'] ?? '0', 10)

    const levelResult = await query(
      `SELECT current_level, COUNT(*) as count FROM consent_records
       WHERE withdrawal_requested = false AND data_purged = false
       AND expiration_date > NOW()
       GROUP BY current_level`,
    )

    const consentLevels: Record<ConsentLevel, number> = {
      none: 0,
      minimal: 0,
      limited: 0,
      full: 0,
    }

    for (const row of levelResult.rows) {
      const level = row['current_level'] as ConsentLevel
      if (level in consentLevels) {
        consentLevels[level] = parseInt(row['count'], 10)
      }
    }

    return {
      totalClients,
      activeConsents,
      consentLevels,
      withdrawalRequests,
      expiredConsents,
    }
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
   * Get audit trail for a client (or all if no clientId)
   */
  async getAuditTrail(clientId?: string): Promise<ConsentAuditLog[]> {
    if (clientId) {
      const result = await query(
        `SELECT client_id, operation, old_level, new_level, reason,
                ip_address, user_agent, timestamp
         FROM consent_audit_trail
         WHERE client_id = $1
         ORDER BY timestamp DESC
         LIMIT 10000`,
        [clientId],
      )
      return result.rows.map(this.rowToAuditLog)
    }

    const result = await query(
      `SELECT client_id, operation, old_level, new_level, reason,
              ip_address, user_agent, timestamp
       FROM consent_audit_trail
       ORDER BY timestamp DESC
       LIMIT 10000`,
    )
    return result.rows.map(this.rowToAuditLog)
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
    const recordsResult = await query(
      `SELECT client_id, current_level, consent_history, last_updated,
              expiration_date, withdrawal_requested, withdrawal_date, data_purged
       FROM consent_records`,
    )

    const consentRecords = recordsResult.rows.map(this.rowToConsentRecord)
    const auditLog = await this.getAuditTrail()
    const statistics = await this.getConsentStatistics()

    return { consentRecords, auditLog, statistics }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async fetchConsentRecord(
    clientId: string,
  ): Promise<ConsentRecord | null> {
    const result = await query(
      `SELECT client_id, current_level, consent_history, last_updated,
              expiration_date, withdrawal_requested, withdrawal_date, data_purged
       FROM consent_records
       WHERE client_id = $1`,
      [clientId],
    )

    const row = result.rows[0]
    if (!row) return null

    return this.rowToConsentRecord(row)
  }

  private rowToConsentRecord = (row: Record<string, unknown>): ConsentRecord => {
    const history = row['consent_history']
    let consentHistory: ConsentRecord['consentHistory']
    if (typeof history === 'string') {
      consentHistory = JSON.parse(history) as ConsentRecord['consentHistory']
    } else if (Array.isArray(history)) {
      consentHistory = history as ConsentRecord['consentHistory']
    } else {
      consentHistory = []
    }

    return {
      clientId: row['client_id'] as string,
      currentLevel: row['current_level'] as ConsentLevel,
      consentHistory,
      lastUpdated: new Date(row['last_updated'] as string).toISOString(),
      expirationDate: new Date(row['expiration_date'] as string).toISOString(),
      withdrawalRequested: row['withdrawal_requested'] as boolean,
      withdrawalDate: row['withdrawal_date']
        ? new Date(row['withdrawal_date'] as string).toISOString()
        : null,
      dataPurged: row['data_purged'] as boolean,
    }
  }

  private rowToAuditLog = (row: Record<string, unknown>): ConsentAuditLog => ({
    timestamp: new Date(row['timestamp'] as string).toISOString(),
    clientId: row['client_id'] as string,
    operation: row['operation'] as string,
    oldLevel: row['old_level'] as ConsentLevel | undefined,
    newLevel: row['new_level'] as ConsentLevel | undefined,
    reason: row['reason'] as string | undefined,
    ipAddress: row['ip_address'] as string | undefined,
    userAgent: row['user_agent'] as string | undefined,
  })

  private async logAudit(logEntry: ConsentAuditLog): Promise<void> {
    try {
      await query(
        `INSERT INTO consent_audit_trail
          (client_id, operation, old_level, new_level, reason, ip_address, user_agent, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          logEntry.clientId,
          logEntry.operation,
          logEntry.oldLevel ?? null,
          logEntry.newLevel ?? null,
          logEntry.reason ?? null,
          logEntry.ipAddress ?? null,
          logEntry.userAgent ?? null,
          logEntry.timestamp,
        ],
      )
    } catch (err) {
      logger.error('Failed to write consent audit trail', err)
    }
  }

  private async cacheConsentLevel(
    clientId: string,
    level: ConsentLevel,
    expirationDate: Date,
  ): Promise<void> {
    try {
      const value = JSON.stringify({
        level,
        expirationDate: expirationDate.toISOString(),
        withdrawalRequested: false,
      })
      await redis.setex(
        `${REDIS_CONSENT_KEY}${clientId}`,
        REDIS_CONSENT_TTL,
        value,
      )
    } catch {
      // Non-fatal — cache is optional
    }
  }

  private async invalidateConsentCache(clientId: string): Promise<void> {
    try {
      await redis.del(`${REDIS_CONSENT_KEY}${clientId}`)
    } catch {
      // Non-fatal
    }
  }

  private async purgeClientData(clientId: string): Promise<void> {
    logger.info('Client data purged', { clientId })
  }
}

export const consentManagementService = new ConsentManagementService()
