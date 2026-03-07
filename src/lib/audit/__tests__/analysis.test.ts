import {
  detectHighFrequency,
  detectOddHours,
  detectSensitiveAccess,
  detectUnusualPatterns,
} from '../analysis'
import type { AuditLog } from '../../types/audit'

describe('Audit Analysis', () => {
  const baseLog: Omit<AuditLog, 'timestamp' | 'userId'> = {
    id: '1',
    action: 'read',
    resourceType: 'document',
    resourceId: 'doc1',
    status: 'success',
    metadata: {},
  }

  describe('detectHighFrequency', () => {
    it('should detect high frequency access patterns', () => {
      const now = new Date()
      const logs: AuditLog[] = Array(60)
        .fill(null)
        .map((_, i) => ({
          ...baseLog,
          id: `log${i}`,
          userId: 'user1',
          timestamp: new Date(now.getTime() - i * 60000), // 1 minute apart
        }))

      const patterns = detectHighFrequency(logs, 60)

      expect(patterns).toHaveLength(1)
      expect(patterns[0]).toMatchObject({
        type: 'high_frequency',
        severity: 'high',
        description: expect.stringContaining('user1'),
        relatedLogs: expect.arrayContaining([
          expect.objectContaining({ userId: 'user1' }),
        ]),
      })
    })

    it('should not detect patterns below threshold', () => {
      const now = new Date()
      const logs: AuditLog[] = Array(10)
        .fill(null)
        .map((_, i) => ({
          ...baseLog,
          id: `log${i}`,
          userId: 'user1',
          timestamp: new Date(now.getTime() - i * 60000),
        }))

      const patterns = detectHighFrequency(logs, 60)
      expect(patterns).toHaveLength(0)
    })
  })

  describe('detectOddHours', () => {
    it('should detect access during unusual hours', () => {
      const logs: AuditLog[] = Array(5)
        .fill(null)
        .map((_, i) => ({
          ...baseLog,
          id: `log${i}`,
          userId: 'user1',
          timestamp: new Date(2024, 0, 1, 23 + Math.floor(i / 2), 30), // 11:30 PM - 1:30 AM
        }))

      const patterns = detectOddHours(logs)

      expect(patterns).toHaveLength(1)
      expect(patterns[0]).toMatchObject({
        type: 'odd_hours',
        severity: 'low',
        description: expect.stringContaining('user1'),
        relatedLogs: expect.arrayContaining([
          expect.objectContaining({ userId: 'user1' }),
        ]),
      })
    })

    it('should not detect patterns during normal hours', () => {
      const logs: AuditLog[] = Array(5)
        .fill(null)
        .map((_, i) => ({
          ...baseLog,
          id: `log${i}`,
          userId: 'user1',
          timestamp: new Date(2024, 0, 1, 14, 30), // 2:30 PM
        }))

      const patterns = detectOddHours(logs)
      expect(patterns).toHaveLength(0)
    })
  })

  describe('detectSensitiveAccess', () => {
    it('should detect frequent access to sensitive resources', () => {
      const logs: AuditLog[] = Array(15)
        .fill(null)
        .map((_, i) => ({
          ...baseLog,
          id: `log${i}`,
          userId: 'user1',
          resourceType: 'pii',
          timestamp: new Date(),
        }))

      const patterns = detectSensitiveAccess(logs)

      expect(patterns).toHaveLength(1)
      expect(patterns[0]).toMatchObject({
        type: 'sensitive_access',
        severity: 'medium',
        description: expect.stringContaining('user1'),
        relatedLogs: expect.arrayContaining([
          expect.objectContaining({ resourceType: 'pii' }),
        ]),
      })
    })

    it('should not detect patterns for non-sensitive resources', () => {
      const logs: AuditLog[] = Array(15)
        .fill(null)
        .map((_, i) => ({
          ...baseLog,
          id: `log${i}`,
          userId: 'user1',
          resourceType: 'public_doc',
          timestamp: new Date(),
        }))

      const patterns = detectSensitiveAccess(logs)
      expect(patterns).toHaveLength(0)
    })
  })

  describe('detectUnusualPatterns', () => {
    it('should combine all detection methods', () => {
      const now = new Date(2024, 0, 1, 23, 30) // 11:30 PM
      const logs: AuditLog[] = [
        // High frequency logs
        ...Array(50)
          .fill(null)
          .map((_, i) => ({
            ...baseLog,
            id: `freq${i}`,
            userId: 'user1',
            timestamp: new Date(now.getTime() - i * 60000),
          })),
        // Odd hours logs
        ...Array(5)
          .fill(null)
          .map((_, i) => ({
            ...baseLog,
            id: `odd${i}`,
            userId: 'user2',
            timestamp: new Date(now.getTime() - i * 60000),
          })),
        // Sensitive access logs
        ...Array(15)
          .fill(null)
          .map((_, i) => ({
            ...baseLog,
            id: `sens${i}`,
            userId: 'user3',
            resourceType: 'pii',
            timestamp: new Date(now.getTime() - i * 60000),
          })),
      ]

      const patterns = detectUnusualPatterns(logs)

      expect(patterns).toHaveLength(3)
      expect(patterns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'high_frequency', severity: 'high' }),
          expect.objectContaining({ type: 'odd_hours', severity: 'low' }),
          expect.objectContaining({
            type: 'sensitive_access',
            severity: 'medium',
          }),
        ]),
      )
    })
  })
})
