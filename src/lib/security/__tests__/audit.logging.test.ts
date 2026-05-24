/* @vitest-environment node */
import type { AuditLogConfig, AuditLogEntry } from '../audit.logging'
import { AuditLoggingService } from '../audit.logging'

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
let debugSpy: ReturnType<typeof vi.spyOn>
let infoSpy: ReturnType<typeof vi.spyOn>
let warnSpy: ReturnType<typeof vi.spyOn>
let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined)
  infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined)
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  auditLoggingService = new AuditLoggingService(testConfig)
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
      expect(infoSpy).toHaveBeenCalled()
      const loggedArg = infoSpy.mock.calls.at(-1)?.[0]
      expect(typeof loggedArg).toBe('string')
      if (typeof loggedArg !== 'string') {
        return
      }
      const parsedEntry = JSON.parse(loggedArg) as Record<string, unknown>
      if (
        typeof parsedEntry !== 'object' ||
        parsedEntry === null ||
        typeof parsedEntry.details !== 'object' ||
        parsedEntry.details === null
      ) {
        return
      }
      const loggedEntry = parsedEntry as {
        details: Record<string, unknown>
        userId?: string
        metadata?: Record<string, unknown>
      }
      expect(loggedEntry).toMatchObject({
        details: { password: '[REDACTED]' },
      })
    })

    it('should handle logging errors gracefully', async () => {
      infoSpy.mockImplementation(() => {
        throw new Error('Storage failed')
      })

      await expect(auditLoggingService.logEvent(testEntry)).rejects.toThrow(
        'Failed to log audit event',
      )
      expect(errorSpy).toHaveBeenCalled()
    })
  })

  describe('sanitizeEntry', () => {
    it('should hash sensitive identifiers when PII is not included', async () => {
      await auditLoggingService.logEvent({
        ...testEntry,
        metadata: { ...testEntry.metadata },
      })

      expect(infoSpy).toHaveBeenCalled()
      const loggedArg = infoSpy.mock.calls.at(-1)?.[0]
      expect(typeof loggedArg).toBe('string')
      if (typeof loggedArg !== 'string') {
        return
      }
      const parsedEntry = JSON.parse(loggedArg) as Record<string, unknown>
      if (
        typeof parsedEntry !== 'object' ||
        parsedEntry === null ||
        typeof parsedEntry.metadata !== 'object' ||
        parsedEntry.metadata === null
      ) {
        return
      }
      const loggedEntry = parsedEntry as {
        userId: string
        metadata: Record<string, unknown>
      }
      expect(loggedEntry.userId).not.toBe(testEntry.userId)
      expect(loggedEntry.metadata?.sessionId).not.toBe(
        testEntry.metadata.sessionId,
      )
    })
  })

  describe('cleanup', () => {
    it('should log cleanup message', async () => {
      await auditLoggingService.cleanup()
      expect(infoSpy).toHaveBeenCalledWith('Audit logging service cleaned up')
      expect(debugSpy).toHaveBeenCalledTimes(0)
      expect(warnSpy).toHaveBeenCalledTimes(0)
    })
  })
})
