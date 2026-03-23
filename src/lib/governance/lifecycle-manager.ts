/**
 * Lifecycle Manager for PHI records
 * Manages retention policies and archival scheduling
 */

export type RetentionPeriod = '30-day' | '90-day' | '7-year' | 'permanent';

export interface RetentionRecord {
  recordId: string;
  period: RetentionPeriod;
  createdAt: Date;
  expiresAt: Date | null;
  archivalScheduledAt?: Date;
}

export class LifecycleManager {
  private retentionRecords: Map<string, RetentionRecord> = new Map();

  /**
   * Apply a retention policy to a record
   */
  applyRetention(
    recordId: string,
    period: RetentionPeriod,
    createdAt: Date
  ): void {
    const expiresAt = this.calculateExpiryDate(createdAt, period);

    const record: RetentionRecord = {
      recordId,
      period,
      createdAt,
      expiresAt,
    };

    this.retentionRecords.set(recordId, record);
  }

  /**
   * Get retention record for a specific record
   */
  getRetention(recordId: string): RetentionRecord | undefined {
    return this.retentionRecords.get(recordId);
  }

  /**
   * Schedule archival for a record
   */
  scheduleArchival(recordId: string, archivalDate: Date): void {
    const record = this.retentionRecords.get(recordId);
    if (!record) {
      throw new Error('Record not found');
    }

    record.archivalScheduledAt = archivalDate;
  }

  /**
   * Calculate expiry date based on period type
   */
  private calculateExpiryDate(
    createdAt: Date,
    period: RetentionPeriod
  ): Date | null {
    switch (period) {
      case '30-day':
        return this.addDays(createdAt, 30);
      case '90-day':
        return this.addDays(createdAt, 90);
      case '7-year':
        return this.addYears(createdAt, 7);
      case 'permanent':
        return null;
      default:
        throw new Error(`Unknown retention period: ${period}`);
    }
  }

  /**
   * Add days to a date
   */
  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Add years to a date
   */
  private addYears(date: Date, years: number): Date {
    const result = new Date(date);
    result.setFullYear(result.getFullYear() + years);
    return result;
  }
}
