import { describe, it, expect, beforeEach } from 'vitest'
import { ComplianceValidator } from '../compliance-validator'

describe('ComplianceValidator', () => {
  let validator: ComplianceValidator

  beforeEach(() => {
    validator = new ComplianceValidator()
  })

  it('validates FHE encryption is active', async () => {
    const result = await validator.validate({
      operation: 'access_phi',
      fheActive: true,
      auditEnabled: true,
      consentVerified: true
    })
    expect(result.compliant).toBe(true)
  })

  it('blocks when FHE is not active', async () => {
    const result = await validator.validate({
      operation: 'access_phi',
      fheActive: false,
      auditEnabled: true,
      consentVerified: true
    })
    expect(result.compliant).toBe(false)
    expect(result.reasons).toContain('FHE encryption required')
  })

  it('blocks when audit is not enabled', async () => {
    const result = await validator.validate({
      operation: 'access_phi',
      fheActive: true,
      auditEnabled: false,
      consentVerified: true
    })
    expect(result.compliant).toBe(false)
    expect(result.reasons).toContain('Audit trail required')
  })

  it('blocks when consent is not verified', async () => {
    const result = await validator.validate({
      operation: 'access_phi',
      fheActive: true,
      auditEnabled: true,
      consentVerified: false
    })
    expect(result.compliant).toBe(false)
    expect(result.reasons).toContain('Consent verification required')
  })

  it('returns timestamp with validation result', async () => {
    const result = await validator.validate({
      operation: 'access_phi',
      fheActive: true,
      auditEnabled: true,
      consentVerified: true
    })
    expect(result.timestamp).toBeDefined()
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp)
  })
})
