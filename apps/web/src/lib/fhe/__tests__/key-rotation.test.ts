/* @vitest-environment node */
/**
 * HIPAA++ Key Rotation Service Tests
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('aws-sdk', () => {
  class MockKms {
    generateDataKey = vi.fn().mockReturnValue({ promise: vi.fn() })
    decrypt = vi.fn().mockReturnValue({ promise: vi.fn() })
  }

  class MockSecretsManager {
    createSecret = vi.fn().mockReturnValue({ promise: vi.fn() })
    rotateSecret = vi.fn().mockReturnValue({ promise: vi.fn() })
    listSecrets = vi.fn().mockReturnValue({
      promise: vi.fn().mockResolvedValue({ SecretList: [] }),
    })
    getSecretValue = vi.fn().mockReturnValue({ promise: vi.fn() })
  }

  class MockCloudWatch {
    putMetricData = vi.fn().mockReturnValue({ promise: vi.fn() })
  }

  return {
    default: {
      KMS: MockKms,
      SecretsManager: MockSecretsManager,
      CloudWatch: MockCloudWatch,
    },
    KMS: MockKms,
    SecretsManager: MockSecretsManager,
    CloudWatch: MockCloudWatch,
  }
})

import type { AuditEvent, SecurityMetrics } from '../key-rotation'
import { KeyRotationService } from '../key-rotation'

// Mock environment variables
process.env['HIPAA_MASTER_SECRET'] =
  'test-master-secret-256-bits-long-for-testing-purposes-only'
process.env['KEY_ROTATION_LAMBDA_ARN'] =
  'arn:aws:lambda:us-east-1:123456789012:function:test-rotation'
process.env['NODE_ENV'] = 'test'

describe('KeyRotationService', () => {
  let service: KeyRotationService

  beforeEach(() => {
    // Reset singleton for testing
    KeyRotationService.resetInstanceForTests()
    service = KeyRotationService.getInstance()
  })

  afterEach(async () => {
    await service.dispose()
  })

  describe('Initialization', () => {
    it('should create singleton instance', () => {
      const instance1 = KeyRotationService.getInstance()
      const instance2 = KeyRotationService.getInstance()
      expect(instance1).toBe(instance2)
    })

    it('should initialize with default HIPAA++ options', async () => {
      await service.initialize()
      expect(service.getActiveKeyId()).toBeDefined()
    })
  })

  describe('Security Metrics', () => {
    it('should return security metrics', () => {
      const metrics: SecurityMetrics = service.getSecurityMetrics()
      expect(metrics).toHaveProperty('rotationAttempts')
      expect(metrics).toHaveProperty('rotationFailures')
      expect(metrics).toHaveProperty('unauthorizedAccess')
      expect(metrics).toHaveProperty('keyCompromiseEvents')
      expect(metrics).toHaveProperty('lastRotation')
      expect(metrics).toHaveProperty('averageRotationTime')
    })
  })

  describe('Audit Events', () => {
    it('should return audit events', () => {
      const events: AuditEvent[] = service.getAuditEvents()
      expect(Array.isArray(events)).toBe(true)
    })

    it('should filter audit events by date', () => {
      const since = new Date(Date.now() - 1000)
      const events: AuditEvent[] = service.getAuditEvents(since)
      expect(Array.isArray(events)).toBe(true)
    })
  })

  describe('Key Rotation', () => {
    it('should perform emergency rotation', async () => {
      await service.initialize()
      const newKeyId = await service.emergencyRotation('Test emergency')
      expect(typeof newKeyId).toBe('string')
      expect(newKeyId).toMatch(/^key_/)
    })
  })

  describe('Key Compromise', () => {
    it('should handle key compromise reporting', async () => {
      await service.initialize()
      const keyId = service.getActiveKeyId()
      expect(keyId).toBeTruthy()
      await service.reportKeyCompromise(keyId!, 'Test compromise')
      // Should trigger emergency rotation
      const newKeyId = service.getActiveKeyId()
      expect(newKeyId).not.toBe(keyId)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing environment variables gracefully', () => {
      process.env['HIPAA_MASTER_SECRET'] = undefined
      expect(() => {
        KeyRotationService.getInstance()
      }).not.toThrow()
    })
  })
})
