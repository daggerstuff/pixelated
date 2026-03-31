import { describe, it, expect, vi } from 'vitest'
import { ComplianceValidator } from '../compliance-validator'

// Mock FHE service for testing integration
const mockFHEService = {
  isInitialized: () => true,
  encrypt: vi.fn().mockResolvedValue({ data: 'encrypted' }),
}

describe('FHE Integration', () => {
  it('blocks encryption when compliance check fails', async () => {
    const validator = new ComplianceValidator()

    // Mock compliance failure - FHE not active
    const result = await validator.validate({
      operation: 'encrypt_phi',
      fheActive: false,
      auditEnabled: true,
      consentVerified: true
    })

    expect(result.compliant).toBe(false)
    expect(result.reasons).toContain('FHE encryption required')
  })

  it('allows encryption when all compliance checks pass', async () => {
    const validator = new ComplianceValidator()

    const result = await validator.validate({
      operation: 'encrypt_phi',
      fheActive: true,
      auditEnabled: true,
      consentVerified: true
    })

    expect(result.compliant).toBe(true)
    
    // Simulate successful encryption
    const encrypted = await mockFHEService.encrypt('test data')
    expect(encrypted.data).toBe('encrypted')
  })

  it('integration wrapper demonstrates pre-flight check pattern', async () => {
    const validator = new ComplianceValidator()

    // Wrapper function pattern for FHE operations
    async function encryptWithCompliance(
      plaintext: string,
      context: { consentVerified: boolean }
    ): Promise<{ data: string }> {
      const compliance = await validator.validate({
        operation: 'encrypt_phi',
        fheActive: mockFHEService.isInitialized(),
        auditEnabled: true,
        consentVerified: context.consentVerified
      })

      if (!compliance.compliant) {
        throw new Error(`Compliance check failed: ${compliance.reasons.join(', ')}`)
      }

      return mockFHEService.encrypt(plaintext)
    }

    // Should succeed with valid context
    const result = await encryptWithCompliance('patient-data', { consentVerified: true })
    expect(result.data).toBe('encrypted')

    // Should fail with invalid context
    await expect(
      encryptWithCompliance('patient-data', { consentVerified: false })
    ).rejects.toThrow('Consent verification required')
  })
})
