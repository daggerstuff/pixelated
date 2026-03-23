/**
 * Tests for ComplianceValidator
 *
 * Validates HIPAA++ compliance checks for:
 * - FHE encryption status
 * - Audit logging status
 * - Consent verification
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ComplianceValidator } from '../compliance-validator'

describe('ComplianceValidator', () => {
  let validator: ComplianceValidator

  beforeEach(() => {
    validator = new ComplianceValidator()
  })

  describe('validate()', () => {
    it('returns compliant: true when FHE is active', async () => {
      // Mock FHE service as active
      const mockFheService = {
        isInitialized: () => true,
      }

      validator.setFheService(mockFheService as any)

      const result = await validator.validate()

      expect(result.compliant).toBe(true)
      expect(result.reasons).toHaveLength(0)
      expect(result.timestamp).toBeDefined()
    })

    it('returns compliant: false with reason when FHE is not active', async () => {
      // Mock FHE service as not active
      const mockFheService = {
        isInitialized: () => false,
      }

      validator.setFheService(mockFheService as any)

      const result = await validator.validate()

      expect(result.compliant).toBe(false)
      expect(result.reasons).toContainEqual(
        expect.objectContaining({
          check: 'fhe_encryption',
          compliant: false,
        })
      )
      expect(result.timestamp).toBeDefined()
    })
  })
})
