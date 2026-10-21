/**
 * Lifecycle Manager for PHI records
 * Manages retention policies and archival scheduling
 */

import { getLogger } from '../logging'

const logger = getLogger('lifecycle-manager')

export type RetentionPeriod = '30-day' | '90-day' | '7-year' | 'permanent'

export interface RetentionRecord {
  recordId: string
  period: RetentionPeriod
  createdAt: Date
  expiresAt: Date | null
  archivalScheduledAt?: Date
  /** Key id of the encryption protecting this record's data, if encrypted. */
  encryptionKeyId?: string
}

export class LifecycleManager {
  private readonly retentionRecords: Map<string, RetentionRecord> = new Map()
  // Alias for secure deletion operations
  private readonly records: Map<string, RetentionRecord> = this.retentionRecords

  /**
   * Apply a retention policy to a record
   */
  applyRetention(
    recordId: string,
    period: RetentionPeriod,
    createdAt: Date,
    encryptionKeyId?: string,
  ): void {
    const expiresAt = this.calculateExpiryDate(createdAt, period)

    const record: RetentionRecord = {
      recordId,
      period,
      createdAt,
      expiresAt,
      encryptionKeyId,
    }

    this.retentionRecords.set(recordId, record)
  }

  /**
   * Get retention record for a specific record
   */
  getRetention(recordId: string): RetentionRecord | undefined {
    return this.retentionRecords.get(recordId)
  }

  /**
   * Schedule archival for a record
   */
  scheduleArchival(recordId: string, archivalDate: Date): void {
    const record = this.retentionRecords.get(recordId)
    if (!record) {
      throw new Error('Record not found')
    }

    record.archivalScheduledAt = archivalDate
  }

  /**
   * Calculate expiry date based on period type
   */
  private calculateExpiryDate(
    createdAt: Date,
    period: RetentionPeriod,
  ): Date | null {
    switch (period) {
      case '30-day':
        return this.addDays(createdAt, 30)
      case '90-day':
        return this.addDays(createdAt, 90)
      case '7-year':
        return this.addYears(createdAt, 7)
      case 'permanent':
        return null
      default:
        throw new Error(`Unknown retention period: ${period}`)
    }
  }

  /**
   * Add days to a date
   */
  private addDays(date: Date, days: number): Date {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
  }

  /**
   * Add years to a date
   */
  private addYears(date: Date, years: number): Date {
    const result = new Date(date)
    result.setFullYear(result.getFullYear() + years)
    return result
  }

  /**
   * Securely delete a record using crypto-shred.
   *
   * When an encryption manager is provided and the record carries the key id
   * of the encryption that protects its data, that key is destroyed so the
   * stored ciphertext becomes permanently unrecoverable — that is the actual
   * shred. Without a key reference there is nothing to shred, so the method
   * reports the honest fallback: the record is removed from the registry but
   * the underlying data is not crypto-shredded.
   */
  async secureDelete(
    resourceId: string,
    encryptionManager?: { destroyKey(keyId: string): boolean },
  ): Promise<{ deleted: boolean; method: string; keyDestroyed?: boolean }> {
    const record = this.records.get(resourceId)
    if (record) {
      this.records.delete(resourceId)

      const keyId = record.encryptionKeyId
      if (encryptionManager && keyId) {
        const keyDestroyed = encryptionManager.destroyKey(keyId)
        logger.info(
          `Crypto-shred deleted ${resourceId} (key ${keyId} destroyed: ${keyDestroyed})`,
        )
        return { deleted: true, method: 'crypto-shred', keyDestroyed }
      }

      logger.warn(
        `Record ${resourceId} deleted from registry without crypto-shred: ` +
          (encryptionManager
            ? 'no encryption key reference on record'
            : 'no encryption manager provided'),
      )
      return { deleted: true, method: 'none' }
    }
    return { deleted: false, method: 'none' }
  }
}
