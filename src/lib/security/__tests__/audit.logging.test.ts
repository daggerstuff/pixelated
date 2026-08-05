/* @vitest-environment node */
import type { AuditLogConfig, AuditLogEntry } from '../audit.logging'
import { AuditLoggingService, getAuditLogger } from '../audit.logging'

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
        typeof parsedEntry['details'] !== 'object' ||
        parsedEntry['details'] === null
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
        typeof parsedEntry['metadata'] !== 'object' ||
        parsedEntry['metadata'] === null
      ) {
        return
      }
      const loggedEntry = parsedEntry as {
        userId: string
        metadata: Record<string, unknown>
      }
      expect(loggedEntry.userId).not.toBe(testEntry.userId)
      expect(loggedEntry.metadata?.['sessionId']).not.toBe(
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

describe('auditLoggingService (real branch coverage)', () => {
  it('redacts all configured sensitive fields, not just password', async () => {
    const svc = new AuditLoggingService({
      logLevel: 'info',
      includeTimestamp: true,
      includePII: false,
      redactFields: ['password', 'token', 'secret', 'ssn', 'dob'],
    })
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'debug').mockImplementation(() => undefined)

    await svc.logEvent({
      ...testEntry,
      details: {
        password: 'p',
        token: 't',
        secret: 's',
        ssn: '123-45-6789',
        dob: '2000-01-01',
        keepMe: 'visible',
      },
    })

    const arg = info.mock.calls.at(-1)?.[0] as string
    const parsed = JSON.parse(arg) as { details: Record<string, unknown> }
    expect(parsed.details['password']).toBe('[REDACTED]')
    expect(parsed.details['token']).toBe('[REDACTED]')
    expect(parsed.details['secret']).toBe('[REDACTED]')
    expect(parsed.details['ssn']).toBe('[REDACTED]')
    expect(parsed.details['dob']).toBe('[REDACTED]')
    expect(parsed.details['keepMe']).toBe('visible')
    vi.restoreAllMocks()
  })

  it('keeps userId and sessionId unhashed when includePII is true', async () => {
    const svc = new AuditLoggingService({
      logLevel: 'info',
      includeTimestamp: true,
      includePII: true,
      redactFields: ['password'],
    })
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'debug').mockImplementation(() => undefined)

    await svc.logEvent({ ...testEntry, metadata: { sessionId: 'sess-1' } })

    const arg = info.mock.calls.at(-1)?.[0] as string
    const parsed = JSON.parse(arg) as {
      userId: string
      metadata: { sessionId: string }
    }
    expect(parsed.userId).toBe(testEntry.userId)
    expect(parsed.metadata['sessionId']).toBe('sess-1')
    vi.restoreAllMocks()
  })

  it('routes output to the configured log level (warn)', async () => {
    const svc = new AuditLoggingService({
      logLevel: 'warn',
      includeTimestamp: true,
      includePII: false,
      redactFields: ['password'],
    })
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined)
    const infoSpy = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'debug').mockImplementation(() => undefined)

    await svc.logEvent(testEntry)

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(infoSpy).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})

describe('auditLoggingService (coverage: levels, unimplemented, factory, dev)', () => {
  const originalNodeEnv = process.env['NODE_ENV']

  afterEach(() => {
    process.env['NODE_ENV'] = originalNodeEnv
    vi.restoreAllMocks()
  })

  it('uses default config when none is provided', async () => {
    const svc = new AuditLoggingService()
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'debug').mockImplementation(() => undefined)

    await svc.logEvent({ ...testEntry, details: { password: 'x' } })

    const arg = info.mock.calls.at(-1)?.[0] as string
    const parsed = JSON.parse(arg) as { details: Record<string, unknown> }
    // default redactFields includes 'password'
    expect(parsed.details['password']).toBe('[REDACTED]')
  })

  it('routes output to the error log level', async () => {
    const svc = new AuditLoggingService({
      logLevel: 'error',
      includeTimestamp: true,
      includePII: false,
      redactFields: ['password'],
    })
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const infoSpy = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'debug').mockImplementation(() => undefined)

    await svc.logEvent(testEntry)

    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(infoSpy).not.toHaveBeenCalled()
  })

  it('routes output to the debug log level', async () => {
    const svc = new AuditLoggingService({
      logLevel: 'debug',
      includeTimestamp: true,
      includePII: false,
      redactFields: ['password'],
    })
    const debugSpy = vi
      .spyOn(console, 'debug')
      .mockImplementation(() => undefined)
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await svc.logEvent(testEntry)

    expect(debugSpy).toHaveBeenCalledTimes(1)
  })

  it('log() delegates to logEvent with the audit context', async () => {
    const svc = new AuditLoggingService({
      logLevel: 'info',
      includeTimestamp: true,
      includePII: false,
      redactFields: ['password'],
    })
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'debug').mockImplementation(() => undefined)

    await svc.log({
      action: 'act',
      resource: 'User',
      resourceId: 'r1',
      userId: 'u1',
      details: { a: 1 },
    })

    const arg = info.mock.calls.at(-1)?.[0] as string
    const parsed = JSON.parse(arg) as { eventType: string; action: string }
    expect(parsed.eventType).toBe('audit')
    expect(parsed.action).toBe('act')
  })

  it('logs to debug in development (storeLogEntry dev branch)', async () => {
    process.env['NODE_ENV'] = 'development'
    const svc = new AuditLoggingService(testConfig)
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined)
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await svc.logEvent(testEntry)

    expect(debug).toHaveBeenCalled()
  })

  it('queryLogs throws not-implemented', async () => {
    const svc = new AuditLoggingService(testConfig)
    await expect(svc.queryLogs({})).rejects.toThrow(
      'Log querying not implemented',
    )
  })

  it('exportLogs throws not-implemented', async () => {
    const svc = new AuditLoggingService(testConfig)
    await expect(svc.exportLogs('json')).rejects.toThrow(
      'Log export not implemented',
    )
  })

  it('getAuditLogger returns an AuditLoggingService instance', () => {
    const logger = getAuditLogger()
    expect(logger).toBeInstanceOf(AuditLoggingService)
  })

  it('cleanup resolves and logs the cleanup message', async () => {
    const svc = new AuditLoggingService(testConfig)
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'debug').mockImplementation(() => undefined)

    await svc.cleanup()

    expect(info).toHaveBeenCalledWith('Audit logging service cleaned up')
  })
})

describe('auditLoggingService (coverage: no userId / no details branches)', () => {
  it('skips userId hashing when userId is absent', async () => {
    const svc = new AuditLoggingService({
      logLevel: 'info',
      includeTimestamp: true,
      includePII: false,
      redactFields: ['password'],
    })
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'debug').mockImplementation(() => undefined)

    await svc.logEvent({
      eventType: 'LOGOUT',
      action: 'logout',
      status: 'success',
      details: { password: 'x' },
      metadata: { ip: '10.0.0.1' },
    })

    const arg = info.mock.calls.at(-1)?.[0] as string
    const parsed = JSON.parse(arg) as { userId?: string }
    expect(parsed.userId).toBeUndefined()
    expect(info).toHaveBeenCalled()
  })

  it('skips the details redaction loop when details is absent', async () => {
    const svc = new AuditLoggingService({
      logLevel: 'info',
      includeTimestamp: true,
      includePII: false,
      redactFields: ['password'],
    })
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'debug').mockImplementation(() => undefined)

    await svc.logEvent({
      eventType: 'PING',
      userId: 'u1',
      action: 'ping',
      status: 'success',
      details: undefined as unknown as Record<string, unknown>,
      metadata: {},
    })

    const arg = info.mock.calls.at(-1)?.[0] as string
    const parsed = JSON.parse(arg) as { details?: unknown }
    expect(parsed.details).toBeUndefined()
    expect(info).toHaveBeenCalled()
  })
})
