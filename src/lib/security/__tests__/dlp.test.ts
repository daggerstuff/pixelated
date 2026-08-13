import { describe, expect, it, vi } from 'vitest'

vi.mock('../../audit', () => ({
  logAuditEvent: vi.fn(),
  AuditEventType: {
    SECURITY: 'security',
    DLP_ALLOWED: 'dlp_allowed',
    DLP_BLOCKED: 'dlp_blocked',
    SECURITY_ALERT: 'security_alert',
  },
}))

vi.mock('../../logging/build-safe-logger', () => ({
  createBuildSafeLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('../phiDetection', () => ({
  detectAndRedactPHI: (text: string) =>
    text.replace(/test@test\.com/g, '[REDACTED]'),
}))

import { DLPService } from '../dlp'

describe('DLPService.processSensitiveContent', () => {
  it('allows clean content without modification', () => {
    const service = new DLPService()
    const result = service.processSensitiveContent(
      'This is a normal message with no sensitive data.',
      { action: 'transmit', contentType: 'text', preserveFormat: false },
    )
    expect(result.content).toBe('This is a normal message with no sensitive data.')
    expect(result.wasModified).toBe(false)
    expect(result.triggeredRules).toHaveLength(0)
  })

  it('redacts content containing PHI/PII', () => {
    const service = new DLPService()
    const result = service.processSensitiveContent(
      'Contact me at test@test.com for details.',
      { action: 'transmit', contentType: 'text', preserveFormat: false },
    )
    expect(result.content).toBe('Contact me at [REDACTED] for details.')
    expect(result.wasModified).toBe(true)
    expect(result.triggeredRules).toContain('phi-detection')
  })

  it('preserves format when preserveFormat is true', () => {
    const service = new DLPService()
    const original = 'Email: test@test.com'
    const result = service.processSensitiveContent(original, {
      action: 'transmit',
      contentType: 'text',
      preserveFormat: true,
    })
    expect(result.content).toHaveLength(original.length)
    expect(result.wasModified).toBe(true)
    expect(result.content).toContain('×')
    expect(result.content).toContain('Email: ')
  })

  it('throws when content is blocked by DLP policy', () => {
    const service = new DLPService()
    const largeContent = 'test@test.com\n' + 'x'.repeat(200 * 1024)
    expect(() =>
      service.processSensitiveContent(largeContent, {
        action: 'export',
        contentType: 'text',
        preserveFormat: false,
      }),
    ).toThrow('blocked by DLP policy')
  })

  it('returns triggered rule IDs', () => {
    const service = new DLPService()
    const result = service.processSensitiveContent(
      'My email is test@test.com',
      { action: 'transmit', contentType: 'text', preserveFormat: false },
    )
    expect(result.triggeredRules).toContain('phi-detection')
    expect(result.wasModified).toBe(true)
  })

  it('allows content when no rules are triggered', () => {
    const service = new DLPService()
    const result = service.processSensitiveContent('Hello world', {
      action: 'view',
      contentType: 'text',
      preserveFormat: false,
    })
    expect(result.wasModified).toBe(false)
    expect(result.triggeredRules).toHaveLength(0)
  })
})
