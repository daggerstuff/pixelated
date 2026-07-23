import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  ConsentExpiryService,
  getConsentExpiryService,
  resetConsentExpiryService,
} from '../ConsentExpiryService'

// ---- Mock setup ----

// In-memory DB + Redis mock for consent persistence tests
const mockConsentStore = new Map<string, Record<string, unknown>>()
const mockAuditTrail: Record<string, unknown>[] = []

vi.mock('@/lib/db', () => ({
  query: vi.fn(async (sql: string, params: unknown[] = []) => {
    const upper = sql.toUpperCase().trim()

    // INSERT INTO consent_audit_trail
    if (upper.startsWith('INSERT INTO CONSENT_AUDIT_TRAIL')) {
      mockAuditTrail.push({
        client_id: params[0],
        operation: params[1],
        old_level: params[2],
        new_level: params[3],
        reason: params[4],
        ip_address: params[5],
        user_agent: params[6],
        timestamp: params[7],
      })
      return { rows: [], rowCount: 1 }
    }

    // INSERT INTO consent_records
    if (upper.startsWith('INSERT INTO CONSENT_RECORDS')) {
      const clientId = params[0] as string
      const level = params[1] as string
      const history = JSON.parse(params[2] as string)
      const now = params[3] as Date
      const exp = params[4] as Date
      mockConsentStore.set(clientId, {
        client_id: clientId,
        current_level: level,
        consent_history: history,
        last_updated: now,
        expiration_date: exp,
        withdrawal_requested: false,
        withdrawal_date: null,
        data_purged: false,
      })
      return { rows: [], rowCount: 1 }
    }

    // UPDATE consent_records SET withdrawal
    if (upper.includes('UPDATE CONSENT_RECORDS SET') && upper.includes('WITHDRAWAL_REQUESTED')) {
      const clientId = params[params.length - 1] as string
      const rec = mockConsentStore.get(clientId)
      if (rec) {
        rec['withdrawal_requested'] = true
        rec['withdrawal_date'] = params[0]
        rec['last_updated'] = params[0]
      }
      return { rows: [], rowCount: 1 }
    }

    // UPDATE consent_records SET data_purged
    if (upper.includes('UPDATE CONSENT_RECORDS SET') && upper.includes('DATA_PURGED')) {
      const clientId = params[0] as string
      const rec = mockConsentStore.get(clientId)
      if (rec) {
        rec['data_purged'] = true
      }
      return { rows: [], rowCount: 1 }
    }

    // UPDATE consent_records SET current_level
    if (upper.includes('UPDATE CONSENT_RECORDS SET')) {
      const clientId = params[params.length - 1] as string
      const rec = mockConsentStore.get(clientId)
      if (rec) {
        rec['current_level'] = params[0]
        rec['consent_history'] = JSON.parse(params[1] as string)
        rec['last_updated'] = params[2]
      }
      return { rows: [], rowCount: 1 }
    }

    // SELECT single consent record
    if (upper.startsWith('SELECT') && upper.includes('FROM CONSENT_RECORDS') && upper.includes('WHERE CLIENT_ID = $1') && !upper.includes('GROUP BY')) {
      const clientId = params[0] as string
      const rec = mockConsentStore.get(clientId)
      return { rows: rec ? [rec] : [], rowCount: rec ? 1 : 0 }
    }

    // SELECT COUNT(*) FROM consent_records (total)
    if (upper.startsWith('SELECT COUNT(*) AS COUNT FROM CONSENT_RECORDS')) {
      return { rows: [{ count: String(mockConsentStore.size) }], rowCount: 1 }
    }

    // SELECT COUNT(*) ... WHERE withdrawal_requested = true
    if (upper.includes('SELECT COUNT(*) AS COUNT FROM CONSENT_RECORDS') && upper.includes('WITHDRAWAL_REQUESTED = TRUE')) {
      const count = Array.from(mockConsentStore.values()).filter(r => r['withdrawal_requested'] === true).length
      return { rows: [{ count: String(count) }], rowCount: 1 }
    }

    // SELECT COUNT(*) ... active
    if (upper.includes('SELECT COUNT(*) AS COUNT FROM CONSENT_RECORDS') && upper.includes('EXPIRATION_DATE > NOW()')) {
      const count = Array.from(mockConsentStore.values()).filter(r =>
        r['withdrawal_requested'] === false && r['data_purged'] === false &&
        new Date(r['expiration_date'] as string) > new Date()
      ).length
      return { rows: [{ count: String(count) }], rowCount: 1 }
    }

    // SELECT COUNT(*) ... expired
    if (upper.includes('SELECT COUNT(*) AS COUNT FROM CONSENT_RECORDS') && upper.includes('EXPIRATION_DATE <= NOW()')) {
      const count = Array.from(mockConsentStore.values()).filter(r =>
        r['expiration_date'] && new Date(r['expiration_date'] as string) <= new Date() &&
        r['withdrawal_requested'] === false && r['data_purged'] === false
      ).length
      return { rows: [{ count: String(count) }], rowCount: 1 }
    }

    // SELECT current_level, COUNT(*) ... GROUP BY
    if (upper.includes('SELECT CURRENT_LEVEL, COUNT(*) AS COUNT') && upper.includes('GROUP BY')) {
      const levels: Record<string, number> = {}
      for (const rec of mockConsentStore.values()) {
        if (rec['withdrawal_requested'] === false && rec['data_purged'] === false &&
            new Date(rec['expiration_date'] as string) > new Date()) {
          const lvl = rec['current_level'] as string
          levels[lvl] = (levels[lvl] ?? 0) + 1
        }
      }
      return { rows: Object.entries(levels).map(([k, v]) => ({ current_level: k, count: String(v) })), rowCount: Object.keys(levels).length }
    }

    // SELECT all consent_records (for export)
    if (upper.startsWith('SELECT') && upper.includes('FROM CONSENT_RECORDS') && !upper.includes('WHERE')) {
      return { rows: Array.from(mockConsentStore.values()), rowCount: mockConsentStore.size }
    }

    // SELECT audit trail by client
    if (upper.includes('FROM CONSENT_AUDIT_TRAIL') && upper.includes('WHERE CLIENT_ID = $1')) {
      const clientId = params[0] as string
      return { rows: mockAuditTrail.filter(e => e['client_id'] === clientId), rowCount: 0 }
    }

    // SELECT all audit trail
    if (upper.includes('FROM CONSENT_AUDIT_TRAIL') && !upper.includes('WHERE')) {
      return { rows: [...mockAuditTrail].reverse(), rowCount: mockAuditTrail.length }
    }

    // Default
    return { rows: [], rowCount: 0 }
  }),
}))

vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  },
}))

vi.mock('@/lib/logging/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

// ---- Tests ----

describe('ConsentExpiryService', () => {
  let service: ConsentExpiryService

  beforeEach(async () => {
    mockConsentStore.clear()
    mockAuditTrail.length = 0
    resetConsentExpiryService()
    service = getConsentExpiryService()
  })

  afterEach(() => {
    resetConsentExpiryService()
  })

  describe('default config', () => {
    it('should have warningDays=30 and criticalDays=7 by default', () => {
      const config = service.getConfig()
      expect(config.warningDays).toBe(30)
      expect(config.criticalDays).toBe(7)
    })

    it('should allow config updates', () => {
      service.setConfig({ warningDays: 60 })
      expect(service.getConfig().warningDays).toBe(60)
      expect(service.getConfig().criticalDays).toBe(7)

      service.setConfig({ criticalDays: 14 })
      expect(service.getConfig().criticalDays).toBe(14)
    })
  })

  describe('checkExpiries', () => {
    it('should return a valid ExpiryCheckResult structure', async () => {
      const result = await service.checkExpiries()

      expect(result).toHaveProperty('checkedAt')
      expect(result).toHaveProperty('totalChecked')
      expect(result).toHaveProperty('reminders')
      expect(result).toHaveProperty('summary')
      expect(result.summary).toHaveProperty('expiringSoon')
      expect(result.summary).toHaveProperty('expiringCritical')
      expect(result.summary).toHaveProperty('expired')
    })

    it('should return empty reminders when no consents exist', async () => {
      const result = await service.checkExpiries()
      expect(result.reminders).toEqual([])
      expect(result.totalChecked).toBe(0)
    })

    it('should detect expired consents', async () => {
      const { consentManagementService } = await import('@/lib/research/services/ConsentManagementService')

      // Create a consent, then manually expire it
      await consentManagementService.initializeConsent('expired-client', 'minimal')

      // Manually set expiration to past
      const rec = mockConsentStore.get('expired-client')!
      rec['expiration_date'] = new Date(Date.now() - 86400000) // 1 day ago

      const result = await service.checkExpiries()
      const expiredReminders = result.reminders.filter(r => r.reminderType === 'expired')
      expect(expiredReminders.length).toBe(1)
      expect(expiredReminders[0].clientId).toBe('expired-client')
    })

    it('should detect expiring-critical consents (≤7 days)', async () => {
      const { consentManagementService } = await import('@/lib/research/services/ConsentManagementService')

      await consentManagementService.initializeConsent('critical-client', 'full')
      const rec = mockConsentStore.get('critical-client')!
      rec['expiration_date'] = new Date(Date.now() + 5 * 86400000) // 5 days from now

      const result = await service.checkExpiries()
      const criticalReminders = result.reminders.filter(r => r.reminderType === 'expiring-critical')
      expect(criticalReminders.length).toBe(1)
      expect(criticalReminders[0].clientId).toBe('critical-client')
    })

    it('should detect expiring-soon consents (≤30 days, >7 days)', async () => {
      const { consentManagementService } = await import('@/lib/research/services/ConsentManagementService')

      await consentManagementService.initializeConsent('soon-client', 'limited')
      const rec = mockConsentStore.get('soon-client')!
      rec['expiration_date'] = new Date(Date.now() + 20 * 86400000) // 20 days from now

      const result = await service.checkExpiries()
      const soonReminders = result.reminders.filter(r => r.reminderType === 'expiring-soon')
      expect(soonReminders.length).toBe(1)
      expect(soonReminders[0].clientId).toBe('soon-client')
    })

    it('should skip withdrawn consents', async () => {
      const { consentManagementService } = await import('@/lib/research/services/ConsentManagementService')

      await consentManagementService.initializeConsent('withdrawn-client', 'full')
      await consentManagementService.requestWithdrawal('withdrawn-client', 'test')

      const result = await service.checkExpiries()
      expect(result.reminders.find(r => r.clientId === 'withdrawn-client')).toBeUndefined()
    })

    it('should skip purged consents', async () => {
      const { consentManagementService } = await import('@/lib/research/services/ConsentManagementService')

      await consentManagementService.initializeConsent('purged-client', 'full')
      await consentManagementService.requestWithdrawal('purged-client', 'test', true)
      await consentManagementService.completeWithdrawal('purged-client')

      const result = await service.checkExpiries()
      expect(result.reminders.find(r => r.clientId === 'purged-client')).toBeUndefined()
    })

    it('should update summary counts correctly', async () => {
      const { consentManagementService } = await import('@/lib/research/services/ConsentManagementService')

      await consentManagementService.initializeConsent('expired-1', 'minimal')
      await consentManagementService.initializeConsent('critical-1', 'full')
      await consentManagementService.initializeConsent('soon-1', 'limited')

      mockConsentStore.get('expired-1')!['expiration_date'] = new Date(Date.now() - 86400000)
      mockConsentStore.get('critical-1')!['expiration_date'] = new Date(Date.now() + 3 * 86400000)
      mockConsentStore.get('soon-1')!['expiration_date'] = new Date(Date.now() + 15 * 86400000)

      const result = await service.checkExpiries()
      expect(result.summary.expired).toBe(1)
      expect(result.summary.expiringCritical).toBe(1)
      expect(result.summary.expiringSoon).toBe(1)
    })
  })

  describe('getExpiringConsents', () => {
    it('should return consents expiring within the given days', async () => {
      const { consentManagementService } = await import('@/lib/research/services/ConsentManagementService')

      await consentManagementService.initializeConsent('far-client', 'full')
      await consentManagementService.initializeConsent('near-client', 'limited')

      // far-client expires in 100 days, near-client in 5 days
      mockConsentStore.get('near-client')!['expiration_date'] = new Date(Date.now() + 5 * 86400000)

      const expiring = await service.getExpiringConsents(30)
      expect(expiring.length).toBe(1)
      expect(expiring[0].clientId).toBe('near-client')
    })

    it('should return empty array when no consents expiring', async () => {
      const expiring = await service.getExpiringConsents(30)
      expect(expiring).toEqual([])
    })

    it('should skip withdrawn and purged consents', async () => {
      const { consentManagementService } = await import('@/lib/research/services/ConsentManagementService')

      await consentManagementService.initializeConsent('active-client', 'full')
      await consentManagementService.initializeConsent('withdrawn-client', 'full')
      await consentManagementService.requestWithdrawal('withdrawn-client', 'test')

      // Both expire soon
      mockConsentStore.get('active-client')!['expiration_date'] = new Date(Date.now() + 3 * 86400000)
      mockConsentStore.get('withdrawn-client')!['expiration_date'] = new Date(Date.now() + 3 * 86400000)

      const expiring = await service.getExpiringConsents(30)
      expect(expiring.length).toBe(1)
      expect(expiring[0].clientId).toBe('active-client')
    })
  })

  describe('singleton', () => {
    it('should return the same instance', () => {
      const a = getConsentExpiryService()
      const b = getConsentExpiryService()
      expect(a).toBe(b)
    })

    it('should return a new instance after reset', () => {
      const a = getConsentExpiryService()
      resetConsentExpiryService()
      const b = getConsentExpiryService()
      expect(a).not.toBe(b)
    })
  })

  describe('ConsentManagementService persistence', () => {
    it('should persist consent record to PostgreSQL on initialize', async () => {
      const { consentManagementService } = await import('@/lib/research/services/ConsentManagementService')
      await consentManagementService.initializeConsent('persist-test', 'full')

      expect(mockConsentStore.has('persist-test')).toBe(true)
      const rec = mockConsentStore.get('persist-test')!
      expect(rec['current_level']).toBe('full')
    })

    it('should persist audit trail to PostgreSQL', async () => {
      const { consentManagementService } = await import('@/lib/research/services/ConsentManagementService')
      await consentManagementService.initializeConsent('audit-test', 'minimal')

      expect(mockAuditTrail.length).toBeGreaterThan(0)
      const entry = mockAuditTrail[0]
      expect(entry['client_id']).toBe('audit-test')
      expect(entry['operation']).toBe('initialize')
    })

    it('should update consent level in PostgreSQL', async () => {
      const { consentManagementService } = await import('@/lib/research/services/ConsentManagementService')
      await consentManagementService.initializeConsent('update-test', 'minimal')
      await consentManagementService.updateConsent({
        clientId: 'update-test',
        newLevel: 'full',
        reason: 'upgrade',
      })

      const rec = mockConsentStore.get('update-test')!
      expect(rec['current_level']).toBe('full')
    })

    it('should mark withdrawal in PostgreSQL', async () => {
      const { consentManagementService } = await import('@/lib/research/services/ConsentManagementService')
      await consentManagementService.initializeConsent('withdraw-test', 'full')
      await consentManagementService.requestWithdrawal('withdraw-test', 'user request')

      const rec = mockConsentStore.get('withdraw-test')!
      expect(rec['withdrawal_requested']).toBe(true)
    })

    it('should mark data purged in PostgreSQL', async () => {
      const { consentManagementService } = await import('@/lib/research/services/ConsentManagementService')
      await consentManagementService.initializeConsent('purge-test', 'full')
      await consentManagementService.requestWithdrawal('purge-test', 'test', true)
      await consentManagementService.completeWithdrawal('purge-test')

      const rec = mockConsentStore.get('purge-test')!
      expect(rec['data_purged']).toBe(true)
    })

    it('should return null for non-existent client', async () => {
      const { consentManagementService } = await import('@/lib/research/services/ConsentManagementService')
      const level = await consentManagementService.getConsentLevel('nonexistent')
      expect(level).toBeNull()
    })

    it('should return null for withdrawn client', async () => {
      const { consentManagementService } = await import('@/lib/research/services/ConsentManagementService')
      await consentManagementService.initializeConsent('withdrawn-level-test', 'full')
      await consentManagementService.requestWithdrawal('withdrawn-level-test', 'test')

      const level = await consentManagementService.getConsentLevel('withdrawn-level-test')
      expect(level).toBeNull()
    })

    it('should return consent level for active client', async () => {
      const { consentManagementService } = await import('@/lib/research/services/ConsentManagementService')
      await consentManagementService.initializeConsent('level-test', 'limited')
      const level = await consentManagementService.getConsentLevel('level-test')
      expect(level).toBe('limited')
    })

    it('should return null for expired consent', async () => {
      const { consentManagementService } = await import('@/lib/research/services/ConsentManagementService')
      await consentManagementService.initializeConsent('expired-level-test', 'full')
      mockConsentStore.get('expired-level-test')!['expiration_date'] = new Date(Date.now() - 86400000)

      const level = await consentManagementService.getConsentLevel('expired-level-test')
      expect(level).toBeNull()
    })

    it('should get consent statistics from PostgreSQL', async () => {
      const { consentManagementService } = await import('@/lib/research/services/ConsentManagementService')
      await consentManagementService.initializeConsent('stat-1', 'minimal')
      await consentManagementService.initializeConsent('stat-2', 'full')
      await consentManagementService.initializeConsent('stat-3', 'limited')

      const stats = await consentManagementService.getConsentStatistics()
      expect(stats.totalClients).toBe(3)
      expect(stats.activeConsents).toBe(3)
      expect(stats.consentLevels.full).toBe(1)
      expect(stats.consentLevels.minimal).toBe(1)
      expect(stats.consentLevels.limited).toBe(1)
    })

    it('should export consent data from PostgreSQL', async () => {
      const { consentManagementService } = await import('@/lib/research/services/ConsentManagementService')
      await consentManagementService.initializeConsent('export-test', 'full')

      const data = await consentManagementService.exportConsentData()
      expect(data.consentRecords.length).toBeGreaterThanOrEqual(1)
      expect(data.auditLog.length).toBeGreaterThanOrEqual(1)
      expect(data.statistics).toBeDefined()
    })

    it('should get audit trail filtered by clientId', async () => {
      const { consentManagementService } = await import('@/lib/research/services/ConsentManagementService')
      await consentManagementService.initializeConsent('audit-filter-1', 'minimal')
      await consentManagementService.initializeConsent('audit-filter-2', 'full')

      const trail = await consentManagementService.getAuditTrail('audit-filter-1')
      expect(trail.every(e => e.clientId === 'audit-filter-1')).toBe(true)
    })

    it('should validate research access correctly', async () => {
      const { consentManagementService } = await import('@/lib/research/services/ConsentManagementService')
      await consentManagementService.initializeConsent('validate-full', 'full')
      await consentManagementService.initializeConsent('validate-minimal', 'minimal')

      const result = await consentManagementService.validateResearchAccess(
        ['validate-full', 'validate-minimal', 'nonexistent'],
        'patternDiscovery',
      )

      expect(result.validClients).toContain('validate-full')
      expect(result.invalidClients).toContain('validate-minimal')
      expect(result.invalidClients).toContain('nonexistent')
    })
  })
})
