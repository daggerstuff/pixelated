import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuditEventType, AuditSeverity } from '../events'

const mocks = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  scanContent: vi.fn(() => {
    throw new Error('DLP service unavailable')
  }),
  uuid: vi.fn(() => 'audit-event-1'),
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

describe('AuditLogger', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

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
