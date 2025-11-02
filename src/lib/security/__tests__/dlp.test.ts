/// <reference types="vitest" />
/* eslint-env vitest */
/* global vi describe it expect beforeEach */

import type { DLPRule } from '../dlp'
import { dlpService, DLPAction } from '../dlp'
import { detectAndRedactPHI } from '../phiDetection'

// Mock dependencies
vi.mock('../phiDetection', () => ({
  detectAndRedactPHI: vi.fn((text: string) => {
    // Simple mock implementation that just redacts emails
    return text.replace(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      '[EMAIL]',
    )
  }),
}))

vi.mock('../../logging', () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

// Mock the audit module including the generateUniqueId function
vi.mock('../../audit/log', () => {
  return {
    generateUniqueId: vi.fn(() => 'mock-uuid-1234567890'),
    logAuditEvent: vi.fn().mockResolvedValue(undefined),
    createResourceAuditLog: vi
      .fn()
      .mockImplementation((action, userId, resource, metadata) => {
        return Promise.resolve({
          id: 'mock-uuid-1234567890',
          timestamp: new Date(),
          action,
          userId,
          resource,
          metadata,
        })
      }),
    AuditEventType: {
      DLP_ALLOWED: 'dlp_allowed',
      DLP_BLOCKED: 'dlp_blocked',
      SECURITY_ALERT: 'security_alert',
    },
    // Include other functions that might be used in the code being tested
    getUserAuditLogs: vi.fn().mockResolvedValue([]),
    getActionAuditLogs: vi.fn().mockResolvedValue([]),
    getAuditLogsByUser: vi.fn().mockResolvedValue([]),
    getAuditLogs: vi.fn().mockResolvedValue([]),
  }
})

vi.mock('../../audit', () => {
  return {
    AuditEventType: {
      DLP_ALLOWED: 'dlp_allowed',
      DLP_BLOCKED: 'dlp_blocked',
      SECURITY_ALERT: 'security_alert',
    },
    AuditLogger: vi.fn(() => ({
      log: vi.fn(),
    })),
  }
})

describe('DLP Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset service by adding a test rule
    const testRule: DLPRule = {
      id: 'test-rule',
      name: 'Test Rule',
      description: 'Rule for testing',
      action: DLPAction.REDACT,
      isActive: true,
      matches: () => true,
      redact: (text) => text.replace('sensitive', '[REDACTED]'),
    }

    // Remove existing rules and add our test rule
    dlpService['rules'] = []
    dlpService.addRule(testRule)
  })

  describe('Rule Management', () => {
    it('should add rules correctly', () => {
      const newRule: DLPRule = {
        id: 'new-rule',
        name: 'New Rule',
        description: 'New rule for testing',
        action: DLPAction.BLOCK,
        isActive: true,
        matches: () => false,
      }

      dlpService.addRule(newRule)
      expect(dlpService['rules'].length).toBeGreaterThan(1)
      expect(dlpService['rules'].find((r) => r.id === 'new-rule')).toBeDefined()
    })

    it('should update existing rules when adding with same ID', () => {
      const updatedRule: DLPRule = {
        id: 'test-rule',
        name: 'Updated Test Rule',
        description: 'Updated rule',
        action: DLPAction.BLOCK,
        isActive: true,
        matches: () => false,
      }

      dlpService.addRule(updatedRule)
      expect(dlpService['rules'].length).toBe(1)
      expect(dlpService['rules'][0].name).toBe('Updated Test Rule')
      expect(dlpService['rules'][0].action).toBe(DLPAction.BLOCK)
    })

    it('should remove rules correctly', () => {
      dlpService.removeRule('test-rule')
      expect(dlpService['rules'].length).toBe(0)
    })
  })

  describe('Content Scanning', () => {
    it('should allow content with no triggered rules', () => {
      // Override rules for this test
      dlpService['rules'] = [
        {
          id: 'no-match',
          name: 'Never Matches',
          description: 'Rule that never matches',
          action: DLPAction.BLOCK,
          isActive: true,
          matches: () => false,
        },
      ]

      const result = dlpService.scanContent('safe content', {
        userId: 'user123',
        action: 'export',
      })

      expect(result.allowed).toBe(true)
      expect(result.triggeredRules).toHaveLength(0)
      expect(result.redactedContent).toBeUndefined()
    })

    it('should redact content when rules with REDACT action are triggered', () => {
      const result = dlpService.scanContent('This is sensitive data', {
        userId: 'user123',
        action: 'export',
      })

      expect(result.allowed).toBe(true)
      expect(result.triggeredRules).toContain('test-rule')
      expect(result.redactedContent).toBe('This is [REDACTED] data')
    })

    it('should block content when rules with BLOCK action are triggered', () => {
      // Override with a blocking rule
      dlpService['rules'] = [
        {
          id: 'block-rule',
          name: 'Block Rule',
          description: 'Rule that blocks',
          action: DLPAction.BLOCK,
          isActive: true,
          matches: () => true,
        },
      ]

      const result = dlpService.scanContent('This should be blocked', {
        userId: 'user123',
        action: 'export',
      })

      expect(result.allowed).toBe(false)
      expect(result.triggeredRules).toContain('block-rule')
      expect(result.reason).toContain('Block Rule')
    })

    it('should generate alerts for BLOCK_AND_ALERT actions', () => {
      // Add a spy to check if the alert method is called
      type DlpServiceType = typeof dlpService
      type GenerateSecurityAlertFn = (
        userId: string,
        action: string,
        content: string,
        ruleName: string,
      ) => void
      const alertSpy = vi.spyOn(
        dlpService as DlpServiceType & {
          generateSecurityAlert: GenerateSecurityAlertFn
        },
        'generateSecurityAlert',
      )

      // Override with an alerting rule
      dlpService['rules'] = [
        {
          id: 'alert-rule',
          name: 'Alert Rule',
          description: 'Rule that alerts',
          action: DLPAction.BLOCK_AND_ALERT,
          isActive: true,
          matches: () => true,
        },
      ]

      dlpService.scanContent('This should trigger an alert', {
        userId: 'user123',
        action: 'export',
      })

      expect(alertSpy).toHaveBeenCalled()
    })
  })

  describe('PHI Detection Integration', () => {
    it('should use PHI detection for scanning', () => {
      // Create a rule that uses PHI detection
      dlpService['rules'] = [
        {
          id: 'phi-rule',
          name: 'PHI Rule',
          description: 'Detects PHI',
          action: DLPAction.REDACT,
          isActive: true,
          matches: (content) => detectAndRedactPHI(content) !== content,
          redact: (content) => detectAndRedactPHI(content),
        },
      ]

      const result = dlpService.scanContent('Contact: john@example.com', {
        userId: 'user123',
        action: 'export',
      })

      expect(detectAndRedactPHI).toHaveBeenCalled()
      expect(result.redactedContent).toBe('Contact: [EMAIL]')
    })
  })

  describe('Default Rules', () => {
    beforeEach(() => {
      // Reset to default rules
      dlpService['rules'] = []
      dlpService['addDefaultRules']()
    })

    it('should have PHI detection rule by default', () => {
      const phiRule = dlpService['rules'].find((r) => r.id === 'phi-detection')
      expect(phiRule).toBeDefined()
      expect(phiRule?.action).toBe(DLPAction.REDACT)
    })

    it('should have large data volume rule by default', () => {
      const volumeRule = dlpService['rules'].find(
        (r) => r.id === 'large-data-volume',
      )
      expect(volumeRule).toBeDefined()
      expect(volumeRule?.action).toBe(DLPAction.BLOCK)
    })

    it('should redact PHI in content with default rules', () => {
      // Set up our PHI detection mock to detect an email
      ;(detectAndRedactPHI as ReturnType<typeof vi.fn>).mockImplementation(
        (text: string) => {
          return text.replace(
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
            '[EMAIL]',
          )
        },
      )

      const result = dlpService.scanContent('Contact us at info@example.com', {
        userId: 'user123',
        action: 'export',
      })

      expect(result.allowed).toBe(true)
      expect(result.redactedContent).toBe('Contact us at [EMAIL]')
    })

    it('should block large data exports that might contain PHI', () => {
      // Mock a large content with PHI
      const largeContent = 'a'.repeat(200 * 1024) + ' patient@example.com'

      // Make sure PHI detection works
      ;(detectAndRedactPHI as ReturnType<typeof vi.fn>).mockImplementation(
        (text: string) => {
          return text.replace(
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
            '[EMAIL]',
          )
        },
      )

      const result = dlpService.scanContent(largeContent, {
        userId: 'user123',
        action: 'export',
        metadata: { dataSize: 200 * 1024 },
      })

      expect(result.allowed).toBe(false)
      expect(result.triggeredRules).toContain('large-data-volume')
    })
  })

  describe('Audit Logging', () => {
    it('should log allowed events with DLP_ALLOWED type', () => {
      type DlpServiceType = typeof dlpService
      type LogDLPEventFn = (event: {
        userId: string
        action: string
        allowed: boolean
        [key: string]: any
      }) => void
      const logSpy = vi.spyOn(
        dlpService as DlpServiceType & { logDLPEvent: LogDLPEventFn },
        'logDLPEvent',
      )

      dlpService.scanContent('Regular content', {
        userId: 'user123',
        action: 'view',
      })

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
          action: 'view',
          allowed: true,
        }),
      )
    })

    it('should log blocked events with DLP_BLOCKED type', () => {
      type DlpServiceType = typeof dlpService
      type LogDLPEventFn = (event: {
        userId: string
        action: string
        allowed: boolean
        [key: string]: any
      }) => void
      const logSpy = vi.spyOn(
        dlpService as DlpServiceType & { logDLPEvent: LogDLPEventFn },
        'logDLPEvent',
      )

      // Add a blocking rule
      dlpService['rules'] = [
        {
          id: 'block-rule',
          name: 'Block Rule',
          description: 'Rule that blocks',
          action: DLPAction.BLOCK,
          isActive: true,
          matches: () => true,
        },
      ]

      dlpService.scanContent('Blocked content', {
        userId: 'user123',
        action: 'export',
      })

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
          action: 'export',
          allowed: false,
        }),
      )
    })
  })
})
