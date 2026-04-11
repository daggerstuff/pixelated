import { describe, it, expect, beforeEach } from 'vitest'

import { LifecycleManager, RetentionPeriod } from '../lifecycle-manager'

describe('LifecycleManager', () => {
  let lifecycleManager: LifecycleManager

  beforeEach(() => {
    lifecycleManager = new LifecycleManager()
  })

  describe('applyRetention', () => {
    it('applies 30-day retention policy to PHI records', () => {
      const recordId = 'phi-record-001'
      const createdDate = new Date('2026-01-01')

      lifecycleManager.applyRetention(recordId, '30-day', createdDate)

      const record = lifecycleManager.getRetention(recordId)
      expect(record).toBeDefined()
      expect(record?.recordId).toBe(recordId)
      expect(record?.period).toBe('30-day')
      expect(record?.createdAt).toEqual(createdDate)

      // Expected expiry: 2026-01-01 + 30 days = 2026-01-31
      const expectedExpiry = new Date('2026-01-31')
      expect(record?.expiresAt).toEqual(expectedExpiry)
    })

    it('applies 90-day retention policy to PHI records', () => {
      const recordId = 'phi-record-002'
      const createdDate = new Date('2026-01-01')

      lifecycleManager.applyRetention(recordId, '90-day', createdDate)

      const record = lifecycleManager.getRetention(recordId)
      expect(record).toBeDefined()
      expect(record?.period).toBe('90-day')

      // Expected expiry: 2026-01-01 + 90 days = 2026-03-31 (2026 is not a leap year)
      const expectedExpiry = new Date('2026-04-01')
      expect(record?.expiresAt).toEqual(expectedExpiry)
    })

    it('applies 7-year retention policy to PHI records', () => {
      const recordId = 'phi-record-003'
      const createdDate = new Date('2026-01-01')

      lifecycleManager.applyRetention(recordId, '7-year', createdDate)

      const record = lifecycleManager.getRetention(recordId)
      expect(record).toBeDefined()
      expect(record?.period).toBe('7-year')

      // Expected expiry: 2026-01-01 + 7 years = 2033-01-01
      const expectedExpiry = new Date('2033-01-01')
      expect(record?.expiresAt).toEqual(expectedExpiry)
    })

    it('applies permanent retention policy to PHI records', () => {
      const recordId = 'phi-record-004'
      const createdDate = new Date('2026-01-01')

      lifecycleManager.applyRetention(recordId, 'permanent', createdDate)

      const record = lifecycleManager.getRetention(recordId)
      expect(record).toBeDefined()
      expect(record?.period).toBe('permanent')
      // Permanent records never expire
      expect(record?.expiresAt).toBe(null)
    })
  })

  describe('getRetention', () => {
    it('returns undefined for non-existent record', () => {
      const record = lifecycleManager.getRetention('non-existent')
      expect(record).toBeUndefined()
    })

    it('returns retention record for existing record', () => {
      const recordId = 'phi-record-005'
      const createdDate = new Date('2026-01-01')

      lifecycleManager.applyRetention(recordId, '30-day', createdDate)

      const record = lifecycleManager.getRetention(recordId)
      expect(record).toBeDefined()
      expect(record?.recordId).toBe(recordId)
    })
  })

  describe('scheduleArchival', () => {
    it('schedules archival for a record', () => {
      const recordId = 'phi-record-006'
      const createdDate = new Date('2026-01-01')
      const archivalDate = new Date('2026-12-01')

      lifecycleManager.applyRetention(recordId, '30-day', createdDate)
      lifecycleManager.scheduleArchival(recordId, archivalDate)

      const record = lifecycleManager.getRetention(recordId)
      expect(record).toBeDefined()
      expect(record?.archivalScheduledAt).toEqual(archivalDate)
    })

    it('throws error when scheduling archival for non-existent record', () => {
      const archivalDate = new Date('2026-12-01')

      expect(() => {
        lifecycleManager.scheduleArchival('non-existent', archivalDate)
      }).toThrow('Record not found')
    })
  })

  describe('secureDelete', () => {
    it('securely deletes a record using crypto-shred', async () => {
      const recordId = 'phi-record-007'
      const createdDate = new Date('2026-01-01')

      lifecycleManager.applyRetention(recordId, '30-day', createdDate)

      const result = await lifecycleManager.secureDelete(recordId)

      expect(result.deleted).toBe(true)
      expect(result.method).toBe('crypto-shred')
      expect(lifecycleManager.getRetention(recordId)).toBeUndefined()
    })

    it('returns not deleted for non-existent record', async () => {
      const result = await lifecycleManager.secureDelete('non-existent')

      expect(result.deleted).toBe(false)
      expect(result.method).toBe('none')
    })
  })
})
