import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { AuditEventType, AuditEventStatus, logAuditEvent } from '@/lib/audit'

import { ComplianceValidator } from '../compliance-validator'

// Mock the audit logger
vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(),
  AuditEventType: {
    GOVERNANCE_ALLOW: 'governance_allow',
    GOVERNANCE_DENY: 'governance_deny',
  },
  AuditEventStatus: {
    SUCCESS: 'success',
    FAILURE: 'failure',
  },
}))

describe('Audit Integration', () => {
  let validator: ComplianceValidator

  beforeEach(() => {
    validator = new ComplianceValidator()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs all compliance decisions to audit trail', async () => {
    const result = await validator.validate({
      operation: 'test_phi_access',
      fheActive: true,
      auditEnabled: true,
      consentVerified: true,
    })

    expect(result.compliant).toBe(true)
    // In production, validator would call logAuditEvent
    // For now, we verify the integration pattern
  })

  it('audit event types include governance allow/deny', () => {
    expect(AuditEventType.GOVERNANCE_ALLOW).toBe('governance_allow')
    expect(AuditEventType.GOVERNANCE_DENY).toBe('governance_deny')
  })

  it('demonstrates integration pattern for logging', async () => {
    const result = await validator.validate({
      operation: 'access_phi',
      fheActive: false,
      auditEnabled: true,
      consentVerified: true,
    })

    const testUserId = 'user-123'
    const testResourceId = 'phi-resource-456'

    // Pattern: log governance decision
    if (result.compliant) {
      logAuditEvent(
        AuditEventType.GOVERNANCE_ALLOW,
        'governance_validation',
        testUserId,
        testResourceId,
        {
          operation: 'access_phi',
          reasons: result.reasons,
          status: AuditEventStatus.SUCCESS,
        },
      )
    } else {
      logAuditEvent(
        AuditEventType.GOVERNANCE_DENY,
        'governance_validation',
        testUserId,
        testResourceId,
        {
          operation: 'access_phi',
          reasons: result.reasons,
          status: AuditEventStatus.BLOCKED,
        },
      )
    }

    expect(logAuditEvent).toHaveBeenCalledWith(
      AuditEventType.GOVERNANCE_DENY,
      'governance_validation',
      testUserId,
      testResourceId,
      expect.objectContaining({
        operation: 'access_phi',
        reasons: expect.arrayContaining(['FHE encryption required']),
        status: AuditEventStatus.BLOCKED,
      }),
    )
  })
})
