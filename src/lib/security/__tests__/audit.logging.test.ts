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

let auditLoggingService: AuditLoggingService

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
      const loggedEntry = JSON.parse(
        mockLogger.info.mock.calls[0][0],
      ) as unknown
      expect(loggedEntry.details.password).toBe('[REDACTED]')
    })

    it('should handle logging errors gracefully', async () => {
      vi.spyOn(
        auditLoggingService as unknown,
        'storeLogEntry',
      ).mockRejectedValue(new Error('Storage failed'))
      await expect(auditLoggingService.logEvent(testEntry)).rejects.toThrow(
        'Failed to log audit event',
      )
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('sanitizeEntry', () => {
    it('should hash sensitive identifiers when PII is not included', () => {
      const hashSpy = vi.spyOn(auditLoggingService as unknown, 'hashValue')

      const sanitizedEntry = (auditLoggingService as unknown).sanitizeEntry({
        ...testEntry,
        timestamp: new Date().toISOString(),
      })

      expect(hashSpy).toHaveBeenCalledWith(testEntry.userId)
      expect(hashSpy).toHaveBeenCalledWith(testEntry.metadata.sessionId)

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
