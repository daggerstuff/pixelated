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
      rules: [{
        id: 'rule-1',
        action: 'access',
        conditions: [{ field: 'userRole', operator: 'equals', value: 'therapist' }],
        required: ['fhe_encryption', 'audit_logged']
      }]
    }
    engine = new PolicyEngine()
  })

  it('evaluates policy with matching conditions', async () => {
    await engine.loadPolicy(testPolicy)
    const result = await engine.evaluate({
      action: 'access',
      context: { userRole: 'therapist', resourceId: 'phi-123' }
    })
    expect(result.allowed).toBe(true)
  })

  it('denies policy with non-matching conditions', async () => {
    await engine.loadPolicy(testPolicy)
    const result = await engine.evaluate({
      action: 'access',
      context: { userRole: 'guest', resourceId: 'phi-123' }
    })
    expect(result.allowed).toBe(false)
  })
})
