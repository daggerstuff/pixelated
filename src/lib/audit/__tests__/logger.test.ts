import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuditEventType, AuditSeverity } from '../events'

const mocks = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  scanContent: vi.fn(() => null),
  uuid: vi.fn(() => 'audit-event-1'),
  connect: vi.fn(),
}))

vi.mock('uuid', () => ({
  v4: mocks.uuid,
}))

vi.mock('../../logging/build-safe-logger', () => ({
  createBuildSafeLogger: vi.fn(() => ({
    info: mocks.info,
    warn: mocks.warn,
    error: mocks.error,
    debug: mocks.debug,
  })),
}))

vi.mock('../../security/dlp', () => ({
  dlpService: {
    scanContent: mocks.scanContent,
  },
}))

vi.mock('../../../config/mongodb.config', () => ({
  mongodb: {
    connect: mocks.connect,
  },
}))

describe('AuditLogger', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  describe('logEvent - volatile fallback', () => {
    it('redacts metadata in the volatile fallback when persistence fails', async () => {
      const { AuditLogger } = await import('../logger')
      const auditLogger = AuditLogger.getInstance()

      vi.spyOn(
        auditLogger as unknown as { persistEventWithRetry: () => Promise<void> },
        'persistEventWithRetry',
      ).mockRejectedValueOnce(new Error('MongoDB unavailable'))

      const payload = {
        userId: 'user-1',
        type: AuditEventType.SECURITY,
        action: 'login',
        severity: AuditSeverity.HIGH,
        metadata: {
          patientName: 'Alice Example',
          email: 'alice@example.com',
        },
        status: 'failure' as const,
      }

      const auditId = await auditLogger.logEvent(payload)

      await Promise.resolve()
      await Promise.resolve()

      expect(auditId).toBe('audit-event-1')
      expect(mocks.scanContent).toHaveBeenCalledTimes(1)
      expect(mocks.error).toHaveBeenCalledWith(
        'CRITICAL: Audit Event Persistence Failed after all retries',
        expect.objectContaining({
          auditId: 'audit-event-1',
          userId: 'user-1',
          error: 'MongoDB unavailable',
        }),
      )
      expect(mocks.info).toHaveBeenCalledWith(
        'Audit Event (Volatile Fallback)',
        expect.objectContaining({
          id: 'audit-event-1',
          metadata: '[REDACTED]',
        }),
      )

      const fallbackPayload = mocks.info.mock.calls.at(-1)?.[1]
      expect(JSON.stringify(fallbackPayload)).not.toContain('Alice Example')
      expect(JSON.stringify(fallbackPayload)).not.toContain('alice@example.com')
    })
  })

  describe('logEvent - successful persistence', () => {
    it('persists event with chain hash when database is available', async () => {
      const mockDb = {
        collection: vi.fn().mockReturnValue({
          findOneAndUpdate: vi.fn().mockResolvedValue({
            seq: 0,
            hash: '0'.repeat(64),
          }),
          insertOne: vi.fn().mockResolvedValue({ insertedId: 'mock-id' }),
        }),
      }
      mocks.connect.mockResolvedValue(mockDb)

      const { AuditLogger } = await import('../logger')
      const auditLogger = AuditLogger.getInstance()

      const payload = {
        userId: 'user-1',
        type: AuditEventType.THERAPEUTIC,
        action: 'session_start',
        severity: AuditSeverity.INFO,
        status: 'success' as const,
      }

      const auditId = await auditLogger.logEvent(payload)

      expect(typeof auditId).toBe('string')
      expect(auditId.length).toBeGreaterThan(0)
      
      // Wait for async persistence queue to flush
      await new Promise((resolve) => setTimeout(resolve, 10))
      
      expect(mockDb.collection).toHaveBeenCalledWith('chain_audit_cursor')
      expect(mockDb.collection).toHaveBeenCalledWith('audit_logs')
    })

    it('assigns unique IDs to each event', async () => {
      let callCount = 0
      mocks.uuid.mockImplementation(() => `audit-event-${++callCount}`)
      
      const mockDb = {
        collection: vi.fn().mockReturnValue({
          findOneAndUpdate: vi.fn().mockResolvedValue({
            seq: 0,
            hash: '0'.repeat(64),
          }),
          insertOne: vi.fn().mockResolvedValue({ insertedId: 'mock-id' }),
        }),
      }
      mocks.connect.mockResolvedValue(mockDb)

      const { AuditLogger } = await import('../logger')
      const auditLogger = AuditLogger.getInstance()

      const id1 = await auditLogger.logEvent({
        userId: 'user-1',
        type: AuditEventType.SYSTEM,
        action: 'test1',
        severity: AuditSeverity.INFO,
        status: 'success',
      })

      const id2 = await auditLogger.logEvent({
        userId: 'user-1',
        type: AuditEventType.SYSTEM,
        action: 'test2',
        severity: AuditSeverity.INFO,
        status: 'success',
      })

      expect(id1).not.toBe(id2)
    })
  })

  describe('getUserEvents', () => {
    it('retrieves events for a specific user with pagination', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          userId: 'user-1',
          timestamp: new Date('2024-01-01'),
          type: AuditEventType.THERAPEUTIC,
          action: 'session_start',
          severity: AuditSeverity.INFO,
          status: 'success',
        },
        {
          id: 'event-2',
          userId: 'user-1',
          timestamp: new Date('2024-01-02'),
          type: AuditEventType.THERAPEUTIC,
          action: 'session_end',
          severity: AuditSeverity.INFO,
          status: 'success',
        },
      ]

      const mockDb = {
        collection: vi.fn().mockReturnValue({
          find: vi.fn().mockReturnValue({
            sort: vi.fn().mockReturnValue({
              skip: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  toArray: vi.fn().mockResolvedValue(mockEvents),
                }),
              }),
            }),
          }),
        }),
      }
      mocks.connect.mockResolvedValue(mockDb)

      const { AuditLogger } = await import('../logger')
      const auditLogger = AuditLogger.getInstance()

      const events = await auditLogger.getUserEvents('user-1', 10, 0)

      expect(events).toHaveLength(2)
      expect(events[0].userId).toBe('user-1')
      expect(mockDb.collection).toHaveBeenCalledWith('audit_logs')
    })

    it('converts string timestamps to Date objects', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          userId: 'user-1',
          timestamp: '2024-01-01T00:00:00.000Z',
          type: AuditEventType.SYSTEM,
          action: 'test',
          severity: AuditSeverity.INFO,
          status: 'success',
        },
      ]

      const mockDb = {
        collection: vi.fn().mockReturnValue({
          find: vi.fn().mockReturnValue({
            sort: vi.fn().mockReturnValue({
              skip: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  toArray: vi.fn().mockResolvedValue(mockEvents),
                }),
              }),
            }),
          }),
        }),
      }
      mocks.connect.mockResolvedValue(mockDb)

      const { AuditLogger } = await import('../logger')
      const auditLogger = AuditLogger.getInstance()

      const events = await auditLogger.getUserEvents('user-1')

      expect(events[0].timestamp).toBeInstanceOf(Date)
    })
  })

  describe('verifyChain', () => {
    it('verifies a valid audit chain', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          userId: 'user-1',
          timestamp: new Date(),
          type: AuditEventType.SYSTEM,
          action: 'test1',
          severity: AuditSeverity.INFO,
          status: 'success',
          previousHash: '0'.repeat(64),
          hash: 'a'.repeat(64),
        },
      ]

      const mockDb = {
        collection: vi.fn().mockReturnValue({
          find: vi.fn().mockReturnValue({
            sort: vi.fn().mockReturnValue({
              toArray: vi.fn().mockResolvedValue(mockEvents),
            }),
          }),
        }),
      }
      mocks.connect.mockResolvedValue(mockDb)

      const { AuditLogger } = await import('../logger')
      const auditLogger = AuditLogger.getInstance()

      const result = await auditLogger.verifyChain()

      expect(result).toBeDefined()
      expect(mockDb.collection).toHaveBeenCalledWith('audit_logs')
    })
  })

  describe('helper functions', () => {
    it('logTherapeuticEvent logs therapeutic session events', async () => {
      const mockDb = {
        collection: vi.fn().mockReturnValue({
          findOneAndUpdate: vi.fn().mockResolvedValue({
            seq: 0,
            hash: '0'.repeat(64),
          }),
          insertOne: vi.fn().mockResolvedValue({ insertedId: 'mock-id' }),
        }),
      }
      mocks.connect.mockResolvedValue(mockDb)

      const { logTherapeuticEvent } = await import('../logger')

      const auditId = await logTherapeuticEvent('user-1', 'session_start', 'session-123', {
        duration: 30,
      })

      expect(typeof auditId).toBe('string')
      expect(auditId.length).toBeGreaterThan(0)
    })

    it('logSecurityAlert logs security events', async () => {
      const mockDb = {
        collection: vi.fn().mockReturnValue({
          findOneAndUpdate: vi.fn().mockResolvedValue({
            seq: 0,
            hash: '0'.repeat(64),
          }),
          insertOne: vi.fn().mockResolvedValue({ insertedId: 'mock-id' }),
        }),
      }
      mocks.connect.mockResolvedValue(mockDb)

      const { logSecurityAlert } = await import('../logger')

      const auditId = await logSecurityAlert(
        'user-1',
        'unauthorized_access',
        AuditSeverity.HIGH,
        { ip: '192.168.1.1' },
        'Access denied',
      )

      expect(typeof auditId).toBe('string')
      expect(auditId.length).toBeGreaterThan(0)
    })
  })

  describe('metadata sanitization', () => {
    it('sanitizes metadata with DLP when service is available', async () => {
      mocks.scanContent.mockReturnValue({
        redactedContent: JSON.stringify({ patientName: '[REDACTED]' }),
      })

      const mockDb = {
        collection: vi.fn().mockReturnValue({
          findOneAndUpdate: vi.fn().mockResolvedValue({
            seq: 0,
            hash: '0'.repeat(64),
          }),
          insertOne: vi.fn().mockResolvedValue({ insertedId: 'mock-id' }),
        }),
      }
      mocks.connect.mockResolvedValue(mockDb)

      const { AuditLogger } = await import('../logger')
      const auditLogger = AuditLogger.getInstance()

      await auditLogger.logEvent({
        userId: 'user-1',
        type: AuditEventType.THERAPEUTIC,
        action: 'session_start',
        severity: AuditSeverity.INFO,
        metadata: { patientName: 'Alice Example' },
        status: 'success',
      })

      expect(mocks.scanContent).toHaveBeenCalled()
    })

    it('handles DLP scan failures gracefully', async () => {
      mocks.scanContent.mockImplementation(() => {
        throw new Error('DLP service error')
      })

      const mockDb = {
        collection: vi.fn().mockReturnValue({
          findOneAndUpdate: vi.fn().mockResolvedValue({
            seq: 0,
            hash: '0'.repeat(64),
          }),
          insertOne: vi.fn().mockResolvedValue({ insertedId: 'mock-id' }),
        }),
      }
      mocks.connect.mockResolvedValue(mockDb)

      const { AuditLogger } = await import('../logger')
      const auditLogger = AuditLogger.getInstance()

      const auditId = await auditLogger.logEvent({
        userId: 'user-1',
        type: AuditEventType.SYSTEM,
        action: 'test',
        severity: AuditSeverity.INFO,
        metadata: { sensitive: 'data' },
        status: 'success',
      })

      expect(typeof auditId).toBe('string')
      expect(auditId.length).toBeGreaterThan(0)
      expect(mocks.error).toHaveBeenCalled()
    })
  })
})