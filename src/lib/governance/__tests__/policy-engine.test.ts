import { describe, it, expect, beforeEach } from 'vitest'

import { PolicyEngine } from '../policy-engine'
import type { GovernancePolicy } from '../types'

describe('PolicyEngine', () => {
  let engine: PolicyEngine
  let testPolicy: GovernancePolicy

  beforeEach(() => {
    testPolicy = {
      id: 'test-phi-access',
      version: '1.0.0',
      rules: [
        {
          id: 'rule-1',
          action: 'access',
          conditions: [
            { field: 'userRole', operator: 'equals', value: 'therapist' },
          ],
          required: ['fhe_encryption', 'audit_logged'],
        },
      ],
    }
    engine = new PolicyEngine()
  })

  it('evaluates policy with matching conditions', async () => {
    await engine.loadPolicy(testPolicy)
    const result = await engine.evaluate({
      action: 'access',
      context: {
        userRole: 'therapist',
        resourceId: 'phi-123',
        fheEncryptionActive: true,
        auditEnabled: true,
      },
    })
    expect(result.allowed).toBe(true)
  })

  it('denies policy with non-matching conditions', async () => {
    await engine.loadPolicy(testPolicy)
    const result = await engine.evaluate({
      action: 'access',
      context: {
        userRole: 'guest',
        resourceId: 'phi-123',
        fheEncryptionActive: true,
        auditEnabled: true,
      },
    })
    expect(result.allowed).toBe(false)
  })

  it('denies when required security controls are missing', async () => {
    await engine.loadPolicy(testPolicy)
    const result = await engine.evaluate({
      action: 'access',
      context: {
        userRole: 'therapist',
        resourceId: 'phi-123',
        fheEncryptionActive: false,
        auditEnabled: true,
      },
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('FHE encryption')
  })

  it('denies when all required controls are missing', async () => {
    await engine.loadPolicy(testPolicy)
    const result = await engine.evaluate({
      action: 'access',
      context: {
        userRole: 'therapist',
        resourceId: 'phi-123',
        fheEncryptionActive: false,
        auditEnabled: false,
      },
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('FHE encryption')
    expect(result.reason).toContain('audit logging')
  })
})

describe('PolicyEngine regex safety', () => {
  let engine: PolicyEngine

  beforeEach(() => {
    engine = new PolicyEngine()
  })

  it('handles regex patterns safely', async () => {
    const policy: GovernancePolicy = {
      id: 'regex-test',
      version: '1.0.0',
      rules: [
        {
          id: 'rule-1',
          action: 'test',
          conditions: [
            {
              field: 'email',
              operator: 'regex',
              value: '^[a-z]+@[a-z]+\\.com$',
            },
          ],
          required: [],
        },
      ],
    }
    await engine.loadPolicy(policy)

    const result = await engine.evaluate({
      action: 'test',
      context: { email: 'test@example.com' },
    })
    expect(result.allowed).toBe(true)
  })
})
