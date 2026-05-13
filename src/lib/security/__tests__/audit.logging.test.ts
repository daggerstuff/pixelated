/* @vitest-environment node */
import type { AuditLogConfig, AuditLogEntry } from '../audit.logging'
import { AuditLoggingService } from '../audit.logging'

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

const testConfig: AuditLogConfig = {
  logLevel: 'info',
  includeTimestamp: true,
  includePII: false,
  redactFields: ['password', 'token', 'secret', 'ssn', 'dob'],
}

const testEntry: Omit<AuditLogEntry, 'timestamp'> = {
  eventType: 'LOGIN_ATTEMPT',
  userId: 'user123',
  resourceType: 'User',
  resourceId: 'user123',
  action: 'login',
  status: 'success',
  details: { password: 'secret' },
  metadata: {
    ip: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    sessionId: 'session123',
  },
}

type AuditLoggingServiceInternals = {
  storeLogEntry: (entry: unknown) => Promise<void>
  hashValue: (...values: string[]) => string
  sanitizeEntry: (entry: AuditLogEntry) => AuditLogEntry
}

let auditLoggingService: AuditLoggingService

const getAuditLoggingService = (service: AuditLoggingService) =>
  service as unknown as AuditLoggingServiceInternals

beforeEach(() => {
  auditLoggingService = new AuditLoggingService(
    testConfig,
    mockLogger as unknown as Console,
  )
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('auditLoggingService', () => {
  describe('logEvent', () => {
    it('should log an event with sanitized details', async () => {
      await expect(
        auditLoggingService.logEvent(testEntry),
      ).resolves.not.toThrow()
      expect(mockLogger.info).toHaveBeenCalled()
      const loggedEntry = JSON.parse(mockLogger.info.mock.calls[0][0]) as {
        details: { password: string }
      }
      expect(loggedEntry.details.password).toBe('[REDACTED]')
    })

    it('should handle logging errors gracefully', async () => {
      const service = getAuditLoggingService(auditLoggingService)
      vi.spyOn(service, 'storeLogEntry').mockRejectedValue(
        new Error('Storage failed'),
      )
      await expect(auditLoggingService.logEvent(testEntry)).rejects.toThrow(
        'Failed to log audit event',
      )
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('sanitizeEntry', () => {
    it('should hash sensitive identifiers when PII is not included', () => {
      const service = getAuditLoggingService(auditLoggingService)
      const hashSpy = vi.spyOn(service, 'hashValue')
      const entryCopy = {
        ...testEntry,
        metadata: { ...testEntry.metadata },
      }

      const sanitizedEntry = service.sanitizeEntry({
        ...entryCopy,
        timestamp: new Date().toISOString(),
      })

      expect(hashSpy).toHaveBeenCalledTimes(2)
      expect(hashSpy).toHaveBeenNthCalledWith(1, testEntry.userId)
      expect(hashSpy).toHaveBeenNthCalledWith(2, testEntry.metadata.sessionId)

      expect(sanitizedEntry.userId).not.toBe(testEntry.userId)
      expect(sanitizedEntry.metadata.sessionId).not.toBe(
        testEntry.metadata.sessionId,
      )

      hashSpy.mockRestore()
    })
  })

  describe('cleanup', () => {
    it('should log cleanup message', async () => {
      await auditLoggingService.cleanup()
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Audit logging service cleaned up',
      )
    })
  })
})
