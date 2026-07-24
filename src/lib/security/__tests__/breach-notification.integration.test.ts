// Mock dependencies
const { mockSendEmail, mockGetUserById } = vi.hoisted(() => ({
  mockSendEmail: vi.fn(),
  mockGetUserById: vi.fn(),
}))

vi.mock('../../redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    keys: vi.fn(),
    hset: vi.fn(),
    expire: vi.fn(),
  },
}))

// Typed mock redis: avoids unbound-method + no-unnecessary-type-assertion lint
const mockRedis = redis as unknown as {
  set: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
  keys: ReturnType<typeof vi.fn>
  hset: ReturnType<typeof vi.fn>
  expire: ReturnType<typeof vi.fn>
}
vi.mock('../../email', () => ({
  sendEmail: mockSendEmail,
}))
vi.mock('../../auth', () => ({
  Auth: vi.fn().mockImplementation(() => ({
    getUserById: mockGetUserById,
  })),
  auth: {
    getUserById: mockGetUserById,
  },
}))
vi.mock('../../fhe', () => ({
  fheService: {
    encrypt: vi.fn(),
  },
}))

// Typed mock fheService: avoids unbound-method lint
const mockFheService = fheService as unknown as {
  encrypt: ReturnType<typeof vi.fn>
}
vi.mock('../../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    // Add other logger methods if used
  },
}))

const { mockRandomBytes, mockRandomUUID } = vi.hoisted(() => ({
  mockRandomBytes: vi.fn().mockReturnValue(Buffer.from('breach-random')),
  mockRandomUUID: vi.fn().mockReturnValue('test-breach-uuid'),
}))

vi.mock('crypto', () => ({
  Buffer: globalThis.Buffer,
  randomBytes: mockRandomBytes,
  randomUUID: mockRandomUUID,
}))

import { fheService } from '../../fhe' // Corrected import
import { logger } from '../../logger'
import { redis } from '../../redis'
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
    vi.mocked(redis['set']).mockResolvedValue('OK')
    vi.mocked(redis['get']).mockResolvedValue(
      JSON.stringify({
        ...mockBreach,
        id: 'test_breach_id',
        timestamp: Date.now(),
        notificationStatus: 'pending',
      }),
    )
    vi.mocked(redis['keys']).mockResolvedValue(['breach:test_breach_id'])
    vi.mocked(redis['hset']).mockResolvedValue(1)
    vi.mocked(redis['expire']).mockResolvedValue(1)
    vi.mocked(redis['hset']).mockResolvedValue(1)
    vi.mocked(redis['expire']).mockResolvedValue(1)

    // Setup auth mock
    mockGetUserById.mockResolvedValue(mockUser)

    // Setup FHE mock
    vi.spyOn(fheService, 'encrypt').mockResolvedValue({
      id: 'enc-1',
      data: 'encrypted_data',
      dataType: 'string',
    })

    process.env['HHS_NOTIFICATION_EMAIL'] = 'hhs@example.com'
    process.env['SECURITY_STAKEHOLDERS'] = ''
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('breach Reporting and Notification', () => {
    it('should successfully report a breach and initiate notifications', async () => {
      const breachId = await reportBreach(mockBreach)

      expect(breachId).toBeDefined()
      expect(mockRedis.set).toHaveBeenCalled()
      expect(mockSendEmail).toHaveBeenCalled()
      expect(logger.error).toHaveBeenCalledWith(
        'Security breach detected:',
        expect.any(Object),
      )
    })

    it('should notify affected users with encrypted details', async () => {
      await reportBreach(mockBreach)

      expect(vi.spyOn(fheService, 'encrypt')).toHaveBeenCalled() // Corrected: FHE to fheService
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockUser.email,
          textContent: expect.any(String),
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
        process.env['HHS_NOTIFICATION_EMAIL'] ?? 'hhs-notifications@example.gov'

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: expectedAuthorityEmail,
          subject: expect.stringContaining('HIPAA Breach Notification'),
        }),
      )
    })

    it('should handle the case when getUserById returns null', async () => {
      mockGetUserById.mockResolvedValue(null)
       await expect(reportBreach(mockBreach)).resolves.not.toThrow()
      expect(mockSendEmail).not.toHaveBeenCalled()
    })

    it('should handle the case when getUserById returns undefined', async () => {
      mockGetUserById.mockResolvedValue(undefined)
       await expect(reportBreach(mockBreach)).resolves.not.toThrow()
      expect(mockSendEmail).not.toHaveBeenCalled()
    })

    it('should continue notifying other users if sending email to one user fails', async () => {
      const userOne = { ...mockUser, id: 'user1', email: 'user1@example.com' }
      const userTwo = { ...mockUser, id: 'user2', email: 'user2@example.com' }
      mockGetUserById
        .mockResolvedValueOnce(userOne)
        .mockResolvedValueOnce(userTwo)
      mockSendEmail
        .mockImplementationOnce(async () =>
          Promise.reject(new Error('Email error')),
        )
        .mockImplementationOnce(async () => Promise.resolve())

      const breachWithMultipleUsers = {
        ...mockBreach,
        affectedUsers: ['user1', 'user2'],
      }

       await expect(reportBreach(breachWithMultipleUsers)).resolves.not.toThrow()

      expect(mockSendEmail).toHaveBeenCalledTimes(2)
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'user1@example.com' }),
      )
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'user2@example.com' }),
      )
    })
  })

  describe('breach Status and Retrieval', () => {
    it('should retrieve breach status', async () => {
      const status = await getBreachStatus('test_breach_id')

      expect(status).toBeDefined()
      expect(status!.type).toBe(mockBreach.type)
      expect(status!.severity).toBe(mockBreach.severity)
    })

    it('should list recent breaches', async () => {
      const breaches = await listRecentBreaches()

      expect(breaches).toHaveLength(1)
      expect(breaches[0].type).toBe(mockBreach.type)
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
      expect(mockRedis.set).toHaveBeenCalledWith(
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
      expect(vi.mocked(typedMaterials).procedures).toBeDefined()
      expect(vi.mocked(typedMaterials).guidelines).toBeDefined()
      expect(vi.mocked(typedMaterials).templates).toBeDefined()
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

      expect(mockRedis.hset).toHaveBeenCalled()
      expect(mockRedis.expire).toHaveBeenCalled()
    })
  })

  describe('error Handling', () => {
    it('should handle redis errors gracefully', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis error'))

      await expect(reportBreach(mockBreach)).rejects.toThrow('Redis error')
      expect(vi.mocked(logger).error).toHaveBeenCalledWith(
        'Failed to report breach:',
        expect.any(Error),
      )
    })

    it('should handle email sending failures', async () => {
      mockSendEmail.mockRejectedValue(new Error('Email error'))

       await expect(reportBreach(mockBreach)).resolves.toBeDefined()

      expect(vi.mocked(logger).error).toHaveBeenCalledWith(
        'Failed to notify user:',
        expect.objectContaining({
          userId: expect.any(String),
          breachId: expect.any(String),
          error: expect.any(Error),
        }),
      )
    })
  })
})
