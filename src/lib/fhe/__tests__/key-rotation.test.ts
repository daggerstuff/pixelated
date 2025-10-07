/**
 * HIPAA++ Key Rotation Service Tests
 */

import { KeyRotationService } from '../key-rotation'
import type { AuditEvent, SecurityMetrics } from '../key-rotation'

// Mock environment variables
process.env.HIPAA_MASTER_SECRET =
  'test-master-secret-256-bits-long-for-testing-purposes-only'
process.env.KEY_ROTATION_LAMBDA_ARN =
  'arn:aws:lambda:us-east-1:123456789012:function:test-rotation'
process.env.NODE_ENV = 'test'

describe('KeyRotationService', () => {
  let service: KeyRotationService

  beforeEach(() => {
    // Reset singleton for testing
    ;(KeyRotationService as unknown).instance = undefined
    service = KeyRotationService.getInstance()
  })

  afterEach(async () => {
    if (service) {
      await service.dispose()
    }
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
      if (keyId) {
        await service.reportKeyCompromise(keyId, 'Test compromise')
        // Should trigger emergency rotation
        const newKeyId = service.getActiveKeyId()
        expect(newKeyId).not.toBe(keyId)
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle missing environment variables gracefully', () => {
      process.env.HIPAA_MASTER_SECRET = undefined
      expect(() => {
        KeyRotationService.getInstance()
      }).not.toThrow()
    })
  })
})
