import { getLogger } from '@/lib/logging/logger'
import { consentManagementService } from '@/lib/research/services/ConsentManagementService'
import type { ConsentRecord, ConsentLevel } from '@/lib/research/types/research-types'

const logger = getLogger('ConsentExpiryService')

export interface ExpiryReminder {
  clientId: string
  consentLevel: ConsentLevel
  expirationDate: string
  daysUntilExpiry: number
  reminderType: 'expiring-soon' | 'expiring-critical' | 'expired'
  message: string
}

export interface ExpiryCheckResult {
  checkedAt: string
  totalChecked: number
  reminders: ExpiryReminder[]
  summary: {
    expiringSoon: number
    expiringCritical: number
    expired: number
  }
}

export interface ExpiryCheckConfig {
  warningDays: number
  criticalDays: number
  batchSize: number
}

export class ConsentExpiryService {
  private readonly config: ExpiryCheckConfig

  constructor(
    config: ExpiryCheckConfig = {
      warningDays: 30,
      criticalDays: 7,
      batchSize: 500,
    },
  ) {
    this.config = config
  }

  async checkExpiries(): Promise<ExpiryCheckResult> {
    logger.info('Running consent expiry check')

    const stats = await consentManagementService.getConsentStatistics()
    const auditTrail = await consentManagementService.getAuditTrail()

    // Reconstruct consent records from audit trail
    // In production, this would query the database directly
    const reminders: ExpiryReminder[] = []
    const now = new Date()

    // Get all unique client IDs from audit trail
    const clientIds = new Set(auditTrail.map((entry) => entry.clientId))

    for (const clientId of clientIds) {
      const record = await consentManagementService.getConsentRecord(clientId)
      if (!record || record.withdrawalRequested || record.dataPurged) {
        continue
      }

      const expirationDate = new Date(record.expirationDate)
      const daysUntilExpiry = Math.ceil(
        (expirationDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
      )

      if (daysUntilExpiry < 0) {
        reminders.push({
          clientId,
          consentLevel: record.currentLevel,
          expirationDate: record.expirationDate,
          daysUntilExpiry,
          reminderType: 'expired',
          message: `Consent for ${clientId} expired ${Math.abs(daysUntilExpiry)} day(s) ago. Re-consent required.`,
        })
      } else if (daysUntilExpiry <= this.config.criticalDays) {
        reminders.push({
          clientId,
          consentLevel: record.currentLevel,
          expirationDate: record.expirationDate,
          daysUntilExpiry,
          reminderType: 'expiring-critical',
          message: `Consent for ${clientId} expires in ${daysUntilExpiry} day(s). Re-consent prompt triggered.`,
        })
      } else if (daysUntilExpiry <= this.config.warningDays) {
        reminders.push({
          clientId,
          consentLevel: record.currentLevel,
          expirationDate: record.expirationDate,
          daysUntilExpiry,
          reminderType: 'expiring-soon',
          message: `Consent for ${clientId} expires in ${daysUntilExpiry} day(s). Upcoming re-consent reminder sent.`,
        })
      }
    }

    const result: ExpiryCheckResult = {
      checkedAt: now.toISOString(),
      totalChecked: stats.totalClients,
      reminders,
      summary: {
        expiringSoon: reminders.filter((r) => r.reminderType === 'expiring-soon').length,
        expiringCritical: reminders.filter((r) => r.reminderType === 'expiring-critical').length,
        expired: reminders.filter((r) => r.reminderType === 'expired').length,
      },
    }

    logger.info('Expiry check complete', result.summary)

    return result
  }

  async getExpiringConsents(days: number = 30): Promise<ConsentRecord[]> {
    const auditTrail = await consentManagementService.getAuditTrail()
    const clientIds = new Set(auditTrail.map((entry) => entry.clientId))
    const now = new Date()
    const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    const expiring: ConsentRecord[] = []

    for (const clientId of clientIds) {
      const record = await consentManagementService.getConsentRecord(clientId)
      if (!record || record.withdrawalRequested || record.dataPurged) {
        continue
      }

      const expirationDate = new Date(record.expirationDate)
      if (expirationDate <= threshold) {
        expiring.push(record)
      }
    }

    return expiring
  }

  getConfig(): ExpiryCheckConfig {
    return { ...this.config }
  }

  setConfig(config: Partial<ExpiryCheckConfig>): void {
    Object.assign(this.config, config)
  }
}

let instance: ConsentExpiryService | null = null

export function getConsentExpiryService(): ConsentExpiryService {
  if (!instance) {
    instance = new ConsentExpiryService()
  }
  return instance
}

export function resetConsentExpiryService(): void {
  instance = null
}
