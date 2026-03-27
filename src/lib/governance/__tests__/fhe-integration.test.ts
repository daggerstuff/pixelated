/**
 * FHE Integration Tests for ComplianceValidator
 *
 * Tests the integration between ComplianceValidator and FHE operations:
 * - ComplianceValidator blocks encryption when compliance check fails
 * - ComplianceValidator validates before FHE operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ComplianceValidator } from '../compliance-validator'
import { RealFHEService } from '../../fhe/fhe-service'
import type { FHEService } from '../../fhe/types'

describe('ComplianceValidator FHE Integration', () => {
  let validator: ComplianceValidator
  let mockFheService: FHEService

  beforeEach(() => {
    validator = new ComplianceValidator()

    // Create mock FHE service
    mockFheService = {
      initialize: vi.fn().mockResolvedValue(undefined),
      isInitialized: vi.fn().mockReturnValue(true),
      encrypt: vi.fn().mockResolvedValue({ id: 'test', data: 'encrypted', dataType: 'string', metadata: {} }),
      decrypt: vi.fn().mockResolvedValue('decrypted'),
      processEncrypted: vi.fn().mockResolvedValue({ success: true, result: null, operation: 'test', timestamp: Date.now() }),
      generateKeys: vi.fn().mockResolvedValue({ keyId: 'test-key', createdAt: new Date(), scheme: 'BFV', status: 'active' }),
      rotateKeys: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn().mockResolvedValue(undefined),
      scheme: {
        name: 'test',
        version: '1.0',
        getOperations: vi.fn().mockReturnValue([]),
        supportsOperation: vi.fn().mockReturnValue(true),
      },
    }
  })

  describe('validateBeforeEncryption()', () => {
    it('returns true when FHE service is initialized', async () => {
      validator.setFheService(mockFheService)

      const result = await validator.validate()

      expect(result.compliant).toBe(true)
      expect(result.reasons).toHaveLength(0)
    })

    it('returns false when FHE service is not initialized', async () => {
      const inactiveFheService = {
        ...mockFheService,
        isInitialized: () => false,
      }
      validator.setFheService(inactiveFheService)

      const result = await validator.validate()

      expect(result.compliant).toBe(false)
      expect(result.reasons).toContainEqual(
        expect.objectContaining({
          check: 'fhe_encryption',
          compliant: false,
        })
      )
    })

    it('blocks encryption when compliance check fails', async () => {
      const inactiveFheService = {
        ...mockFheService,
        isInitialized: () => false,
      }
      validator.setFheService(inactiveFheService)

      const result = await validator.validate()

      expect(result.compliant).toBe(false)
      expect(result.reasons.some(r => 'check' in r && r.check === 'fhe_encryption')).toBe(true)
    })
  })

  describe('encrypt with compliance check', () => {
    it('allows encryption when compliance check passes', async () => {
      validator.setFheService(mockFheService)

      const complianceResult = await validator.validate()

      expect(complianceResult.compliant).toBe(true)

      const encrypted = await mockFheService.encrypt('test data')
      expect(encrypted).toBeDefined()
    })

    it('identifies non-compliance when FHE is not active', async () => {
      const inactiveFheService = {
        ...mockFheService,
        isInitialized: () => false,
      }
      validator.setFheService(inactiveFheService)

      const complianceResult = await validator.validate()

      expect(complianceResult.compliant).toBe(false)
      expect(complianceResult.reasons).toContainEqual(
        expect.objectContaining({
          check: 'fhe_encryption',
          compliant: false,
          reason: expect.stringContaining('not active'),
        })
      )
    })
  })

  describe('audit logging integration', () => {
    it('validates audit service when configured', async () => {
      validator.setFheService(mockFheService)

      const mockAuditService = {
        isActive: () => true,
      }
      validator.setAuditService(mockAuditService)

      const result = await validator.validate()

      expect(result.compliant).toBe(true)
    })

    it('fails validation when audit service is not active', async () => {
      validator.setFheService(mockFheService)

      const mockAuditService = {
        isActive: () => false,
      }
      validator.setAuditService(mockAuditService)

      const result = await validator.validate()

      expect(result.compliant).toBe(false)
      expect(result.reasons).toContainEqual(
        expect.objectContaining({
          check: 'audit_logging',
          compliant: false,
        })
      )
    })
  })

  describe('consent verification integration', () => {
    it('validates consent service when configured', async () => {
      validator.setFheService(mockFheService)

      const mockConsentService = {
        isEnabled: () => true,
      }
      validator.setConsentService(mockConsentService)

      const result = await validator.validate()

      expect(result.compliant).toBe(true)
    })

    it('fails validation when consent service is not enabled', async () => {
      validator.setFheService(mockFheService)

      const mockConsentService = {
        isEnabled: () => false,
      }
      validator.setConsentService(mockConsentService)

      const result = await validator.validate()

      expect(result.compliant).toBe(false)
      expect(result.reasons).toContainEqual(
        expect.objectContaining({
          check: 'consent_verification',
          compliant: false,
        })
      )
    })
  })

  describe('comprehensive compliance workflow', () => {
    it('completes full workflow: validate then encrypt', async () => {
      validator.setFheService(mockFheService)

      const mockAuditService = {
        isActive: () => true,
      }
      const mockConsentService = {
        isEnabled: () => true,
      }
      validator.setAuditService(mockAuditService)
      validator.setConsentService(mockConsentService)

      const complianceResult = await validator.validate()

      expect(complianceResult.compliant).toBe(true)

      if (complianceResult.compliant) {
        const encrypted = await mockFheService.encrypt({ userId: '123', data: 'test' })
        expect(encrypted).toBeDefined()
      }
    })

    it('blocks encryption when any compliance check fails', async () => {
      validator.setFheService(mockFheService)

      const mockAuditService = {
        isActive: () => false,
      }
      validator.setAuditService(mockAuditService)

      const complianceResult = await validator.validate()

      expect(complianceResult.compliant).toBe(false)
    })
  })
})
