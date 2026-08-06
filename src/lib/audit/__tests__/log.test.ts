// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  uuid: vi.fn(() => 'audit-event-1'),
  scanContent: vi.fn(() => ({ redactedContent: null })),
}))

vi.mock('uuid', () => ({ v4: mocks.uuid }))
vi.mock('../../logging/build-safe-logger', () => ({
  createBuildSafeLogger: vi.fn(() => ({
    info: mocks.info,
    warn: mocks.warn,
    error: mocks.error,
    debug: mocks.debug,
  })),
}))
vi.mock('../../security/dlp', () => ({
  dlpService: { scanContent: mocks.scanContent },
}))

describe('logGovernanceDecision', () => {
  let logEventSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('records a real governance_allow audit event', async () => {
    const { AuditLogger } = await import('../logger')
    const { logGovernanceDecision } = await import('../log')

    logEventSpy = vi
      .spyOn(AuditLogger.getInstance(), 'logEvent')
      .mockResolvedValue('audit-event-1')

    await logGovernanceDecision('user-123', 'phi-1', true, {
      operation: 'op',
      reasons: ['r'],
    })

    expect(logEventSpy).toHaveBeenCalledTimes(1)
    const event = logEventSpy.mock.calls[0][0]
    expect(event.type).toBe('governance_allow')
    expect(event.action).toBe('governance_validation')
    expect(event.status).toBe('success')
    expect(event.userId).toBe('user-123')
    expect(event.resourceId).toBe('phi-1')
    expect(event.metadata.operation).toBe('op')
    expect(event.metadata.reasons).toEqual(['r'])
  })

  it('records a governance_deny audit event for a rejected decision', async () => {
    const { AuditLogger } = await import('../logger')
    const { logGovernanceDecision } = await import('../log')

    logEventSpy = vi
      .spyOn(AuditLogger.getInstance(), 'logEvent')
      .mockResolvedValue('audit-event-1')

    await logGovernanceDecision('user-9', 'res-9', false, {
      operation: 'op',
      reasons: ['FHE encryption required'],
    })

    expect(logEventSpy).toHaveBeenCalledTimes(1)
    const event = logEventSpy.mock.calls[0][0]
    expect(event.type).toBe('governance_deny')
    expect(event.status).toBe('failure')
    expect(event.metadata.reasons).toContain('FHE encryption required')
  })
})
