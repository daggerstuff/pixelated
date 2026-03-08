// Mock dependencies
vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    keys: vi.fn(),
    hset: vi.fn(),
    expire: vi.fn(),
    // Add any other redis functions that are used directly or indirectly by the code under test
  },
  // Mock other exports from '@/lib/redis' if any are used
}))
const mockSendEmail = vi.fn()
vi.mock('@/lib/email', () => ({
  sendEmail: mockSendEmail,
}))
const mockGetUserById = vi.fn()
vi.mock('@/lib/auth', () => ({
  Auth: vi.fn().mockImplementation(() => ({
    getUserById: mockGetUserById,
  })),
  auth: {
    getUserById: mockGetUserById,
  },
}))
vi.mock('@/lib/fhe', () => ({
  fheService: {
    encrypt: vi.fn(),
    // Add other methods of fheService if they are used
  },
}))
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    // Add other logger methods if used
  },
}))

import { fheService } from '@/lib/fhe' // Corrected import
import { logger } from '@/lib/logger'
import { redis } from '@/lib/redis'
import {
  reportBreach,
  getBreachStatus,
  listRecentBreaches,
  runTestScenario,
  getTrainingMaterials,
  updateMetrics,
  type BreachDetails,
} from '../breach-notification'

describe('breachNotificationSystem Integration Tests', () => {
  const mockBreach = {
    type: 'unauthorized_access' as const,
    severity: 'high' as const,
    description: 'Test breach',
    affectedUsers: ['user1', 'user2'],
    affectedData: ['personal_info'],
    detectionMethod: 'system_monitoring',
    remediation: 'Access revoked and passwords reset',
  }

  const mockUser = {
    id: 'user1',
    email: 'user@test.com',
    name: 'Test User',
  }

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks()

    // Setup redis mock
    vi.mocked(redis.set).mockResolvedValue('OK')
    vi.mocked(redis.get).mockResolvedValue(
      JSON.stringify({
        ...mockBreach,
        id: 'test_breach_id',
        timestamp: Date.now(),
        notificationStatus: 'pending',
      }),
    )
    vi.mocked(redis.keys).mockResolvedValue(['breach:test_breach_id'])
    vi.mocked(redis.hset).mockResolvedValue(1)
    vi.mocked(redis.expire).mockResolvedValue(1)
    vi.mocked(redis.hset).mockResolvedValue(1)
    vi.mocked(redis.expire).mockResolvedValue(1)

    // Setup auth mock
    mockGetUserById.mockResolvedValue(mockUser)

    // Setup FHE mock
    vi.mocked(fheService.encrypt).mockResolvedValue('encrypted_data') // Corrected to use fheService
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('breach Reporting and Notification', () => {
    it('should successfully report a breach and initiate notifications', async () => {
      const breachId = await reportBreach(mockBreach)

      expect(breachId).toBeDefined()
      expect(redis.set).toHaveBeenCalled()
      expect(mockSendEmail).toHaveBeenCalled()
      expect(logger.error).toHaveBeenCalled() // Restored assertion for expected logging
    })

    it('should notify affected users with encrypted details', async () => {
      await reportBreach(mockBreach)

      expect(fheService.encrypt).toHaveBeenCalled() // Corrected: FHE to fheService
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockUser.email,
          priority: 'urgent',
          metadata: expect.objectContaining({
            type: 'security_breach',
            encryptedDetails: 'encrypted_data',
          }),
        }),
      )
    })

    it('should notify authorities for large breaches', async () => {
      const largeBreach = {
        ...mockBreach,
        affectedUsers: Array.from({ length: 500 }, (_, i) => `user${i}`),
      }

      await reportBreach(largeBreach)

      const expectedAuthorityEmail =
        process.env['HHS_NOTIFICATION_EMAIL'] || 'hhs-notifications@example.gov'

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: expectedAuthorityEmail,
          priority: 'urgent',
          metadata: expect.objectContaining({
            type: 'hipaa_breach_notification',
          }),
        }),
      )
    })

    it('should handle the case when getUserById returns null', async () => {
      mockGetUserById.mockResolvedValueOnce(null)
      await expect(reportBreach(mockBreach)).resolves.not.toThrow()
      expect(mockSendEmail).not.toHaveBeenCalled()
    })

    it('should handle the case when getUserById returns undefined', async () => {
      mockGetUserById.mockResolvedValueOnce(undefined)
      await expect(reportBreach(mockBreach)).resolves.not.toThrow()
      expect(mockSendEmail).not.toHaveBeenCalled()
    })

    it('should continue notifying other users if sending email to one user fails', async () => {
      const users = [
        { ...mockUser, email: 'user1@example.com' },
        { ...mockUser, email: 'user2@example.com' },
      ]
      mockSendEmail
        .mockImplementationOnce(() => Promise.reject(new Error('Email error')))
        .mockImplementationOnce(() => Promise.resolve())

      const breachWithMultipleUsers = { ...mockBreach, users }

      await expect(reportBreach(breachWithMultipleUsers)).resolves.not.toThrow()

      expect(mockSendEmail).toHaveBeenCalledTimes(2)
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'user1@example.com' }),
        expect.anything(),
      )
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'user2@example.com' }),
        expect.anything(),
      )
    })
  })

  describe('breach Status and Retrieval', () => {
    it('should retrieve breach status', async () => {
      const status = await getBreachStatus('test_breach_id')

      expect(status).toBeDefined()
      expect(status?.type).toBe(mockBreach.type)
      expect(status?.severity).toBe(mockBreach.severity)
    })

    it('should list recent breaches', async () => {
      const breaches = await listRecentBreaches()

      expect(breaches).toHaveLength(1)
      expect(breaches[0]?.type).toBe(mockBreach.type)
    })
  })

  describe('test Scenarios and Documentation', () => {
    it('should run test scenarios successfully', async () => {
      const scenario = {
        type: 'data_leak' as const,
        severity: 'medium' as const,
        affectedUsers: 10,
      }

      const breachId = await runTestScenario(scenario)

      expect(breachId).toBeDefined()
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('breach:test:'),
        expect.any(String),
        'EX',
        expect.any(Number),
      )
    })

    it('should retrieve training materials', async () => {
      const materials = await getTrainingMaterials()

      expect(materials).toBeDefined()
      // Type assertion to satisfy TypeScript
      const typedMaterials = materials as {
        procedures?: unknown
        guidelines?: unknown
        templates?: unknown
      }
      expect(typedMaterials.procedures).toBeDefined()
      expect(typedMaterials.guidelines).toBeDefined()
      expect(typedMaterials.templates).toBeDefined()
    })
  })

  describe('metrics and Analysis', () => {
    it('should update breach metrics', async () => {
      const breach: BreachDetails = {
        ...mockBreach,
        id: 'test_breach_id',
        timestamp: Date.now(),
        notificationStatus: 'completed', // must be one of the allowed literals
      }

      await updateMetrics(breach)

      expect(redis.hset).toHaveBeenCalled()
      expect(redis.expire).toHaveBeenCalled()
    })
  })

  describe('error Handling', () => {
    it('should handle redis errors gracefully', async () => {
      vi.mocked(redis.set).mockRejectedValue(new Error('Redis error'))

      await expect(reportBreach(mockBreach)).rejects.toThrow('Redis error')
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to report breach:',
        expect.any(Error),
      )
    })

    it('should handle email sending failures', async () => {
      mockSendEmail.mockRejectedValue(new Error('Email error'))

      await expect(reportBreach(mockBreach)).rejects.toThrow('Email error')

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to notify user:',
        expect.objectContaining({
          userId: expect.any(String),
          breachId: expect.any(String),
          error: expect.any(Error),
        }),
      )

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to report breach:',
        expect.any(Error),
      )
    })
  })
})
