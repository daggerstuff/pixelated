import { EmailService } from '../EmailService'

const { mockSend, mockRedisMethods, mockLogger } = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }

  return {
    mockSend: vi.fn(),
    mockLogger,
    mockRedisMethods: {
      lpush: vi.fn(),
      rpoplpush: vi.fn(),
      lrem: vi.fn(),
      llen: vi.fn(),
      lrange: vi.fn(),
      zadd: vi.fn(),
      zrangebyscore: vi.fn(),
      zremrangebyscore: vi.fn(),
      keys: vi.fn(),
      hget: vi.fn(),
      hgetall: vi.fn(),
      hset: vi.fn(),
      hdel: vi.fn(),
      del: vi.fn(),
      on: vi.fn().mockReturnThis(),
      quit: vi.fn().mockResolvedValue('OK'),
    },
  }
})

// Mock Redis service with proper getClient implementation
vi.mock('@/lib/services/redis', () => ({
  RedisService: vi.fn().mockImplementation(() => ({
    getClient: vi.fn().mockReturnValue(mockRedisMethods),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
  })),
  redis: mockRedisMethods,
}))

// Mock ioredis more completely
vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      ...mockRedisMethods,
    })),
  }
})

vi.mock('@/lib/utils/logger', async () => {
  return {
    getLogger: vi.fn(() => mockLogger),
    logger: mockLogger,
  }
})

vi.mock('@/config/env.config', () => ({
  config: {
    email: {
      resendApiKey: () => 'test-api-key',
    },
  },
}))
vi.mock('@postmark/core')

// Mock Resend with proper types
vi.mock('resend', () => {
  return {
    Resend: vi.fn(function () {
      return {
        emails: {
          send: mockSend,
        },
      }
    }),
  }
})

describe('emailService', () => {
  let emailService: EmailService

  beforeEach(() => {
    vi.clearAllMocks()
    emailService = new EmailService()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('queueEmail', () => {
    it('should queue a valid email', async () => {
      const emailData = {
        to: 'test@example.com',
        templateAlias: 'welcome',
        templateModel: { name: 'Test User' },
      }

      await emailService.queueEmail(emailData as any)

      expect(mockRedisMethods.lpush).toHaveBeenCalledTimes(1)
      const queueItem = JSON.parse(
        (mockRedisMethods.lpush as ReturnType<typeof vi.fn>).mock.calls[0][1],
      )
      expect(queueItem).toMatchObject({
        data: emailData,
        attempts: 0,
        error: null,
      })
      expect(queueItem.id).toBeDefined()
    })

    it('should throw error for invalid email data', async () => {
      const invalidEmailData = {
        to: 'invalid-email',
        templateAlias: 'welcome',
        templateModel: { name: 'Test User' },
      }

      await expect(
        emailService.queueEmail(invalidEmailData as any),
      ).rejects.toThrow()
    })
  })

  describe('processQueue', () => {
    it('should process queued email successfully', async () => {
      // Setup template
      const template = {
        alias: 'welcome',
        subject: 'Welcome {{name}}',
        htmlBody: '<p>Hello {{name}}</p>',
        textBody: 'Hello {{name}}',
        from: 'test@example.com',
      }
      await emailService.upsertTemplate(template)

      // Setup queue item
      const queueItem = {
        id: 'test-id',
        data: {
          to: 'test@example.com',
          templateAlias: 'welcome',
          templateModel: { name: 'Test User' },
        },
        attempts: 0,
        lastAttempt: null,
        error: null,
      }

      // Mock successful email send
      mockSend.mockResolvedValueOnce({
        data: { id: 'test-send-id' },
        error: null,
      })

      // Mock queue operations
      ;(
        mockRedisMethods.rpoplpush as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(JSON.stringify(queueItem))
      ;(
        mockRedisMethods.rpoplpush as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(null)

      await emailService.processQueue()

      expect(mockSend).toHaveBeenCalledWith({
        from: 'test@example.com',
        to: 'test@example.com',
        subject: 'Welcome {{name}}',
        html: '<p>Hello Test User</p>',
        text: 'Hello Test User',
      })

      expect(mockRedisMethods.lrem).toHaveBeenCalledWith(
        'email:processing',
        1,
        JSON.stringify(queueItem),
      )
    })

    it('should handle email sending failure', async () => {
      // Setup template
      const template = {
        alias: 'welcome',
        subject: 'Welcome {{name}}',
        htmlBody: '<p>Hello {{name}}</p>',
        from: 'test@example.com',
      }
      await emailService.upsertTemplate(template)

      // Setup queue item
      const queueItem = {
        id: 'test-id',
        data: {
          to: 'test@example.com',
          templateAlias: 'welcome',
          templateModel: { name: 'Test User' },
        },
        attempts: 0,
        lastAttempt: null,
        error: null,
      }

      // Mock failed email send
      mockSend.mockResolvedValueOnce({
        data: null,
        error: new Error('Send failed'),
      })

      // Mock queue operations
      ;(
        mockRedisMethods.rpoplpush as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(JSON.stringify(queueItem))
      ;(
        mockRedisMethods.rpoplpush as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(null)

      await emailService.processQueue()

      // Check that the item was put back in the queue
      expect(mockRedisMethods.lpush).toHaveBeenCalledWith(
        'email:queue',
        expect.stringContaining('"attempts":1'),
      )
    })
  })

  describe('upsertTemplate', () => {
    it('should store a valid template', async () => {
      const template = {
        alias: 'welcome',
        subject: 'Welcome',
        htmlBody: '<p>Welcome</p>',
        from: 'test@example.com',
      }

      await emailService.upsertTemplate(template)

      // Send an email using the template to verify it was stored
      const emailData = {
        to: 'test@example.com',
        templateAlias: 'welcome',
        templateModel: {},
      }

      await emailService.queueEmail(emailData as any)
    })

    it('should throw error for invalid template', async () => {
      const invalidTemplate = {
        alias: 'welcome',
        subject: 'Welcome',
        // Missing required fields
      }

      await expect(
        emailService.upsertTemplate(
          invalidTemplate as {
            alias: string
            subject: string
            htmlBody: string
            from: string
          },
        ),
      ).rejects.toThrow()
    })
  })

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      ;(mockRedisMethods.llen as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2)

      const stats = await emailService.getQueueStats()

      expect(stats).toEqual({
        queued: 5,
        processing: 2,
      })
    })
  })
})
