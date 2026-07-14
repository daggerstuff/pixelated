/* @vitest-environment node */
import { WebSocket } from 'ws'

import { config } from '@/config/env.config'
import { redis } from '@/lib/redis'

import {
  NotificationChannel,
  NotificationPriority,
  NotificationService,
  NotificationStatus,
} from '../NotificationService'

vi.mock('../pushUtils', () => ({
  generateVAPIDKeys: vi.fn(async () => ({
    publicKey: 'mock-public-key',
    privateKey: 'mock-private-key',
  })),
  sendNotification: vi.fn(async () => {}),
}))

vi.mock('../smsUtils', () => ({
  sendSMS: vi.fn(async () => {}),
  isValidPhoneNumber: vi.fn(() => true),
}))

// Type for accessing private properties in tests
interface NotificationServiceTestInterface {
  wsClients: Map<string, WebSocket>
  emailService: {
    upsertTemplate: (template: unknown) => Promise<void>
    queueEmail?: (..._args: unknown[]) => Promise<unknown>
  }
  deliverInApp: (notification: unknown) => Promise<void>
  deliverPush: (notification: unknown) => Promise<void>
}

// Mock dependencies
vi.mock('@/lib/redis', () => ({
  redis: {
    lpush: vi.fn(async (key, _value) => {
      if (key === 'notification_queue') {
        return Promise.resolve(1)
      }
      return Promise.resolve(0)
    }),
    rpoplpush: vi
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify({
          id: 'test-id',
          userId: 'test-user',
          templateId: 'test-template',
          title: 'Test',
          body: 'Test',
          data: {},
          channels: ['in_app', 'email'],
          priority: 'normal',
          status: 'pending',
          createdAt: Date.now(),
          deliveredAt: null,
          readAt: null,
          error: null,
        }),
      )
      .mockResolvedValue(null),
    lrem: vi.fn().mockResolvedValue(1),
    llen: vi.fn().mockResolvedValue(0),
    lrange: vi.fn().mockResolvedValue([]),
    zadd: vi.fn().mockResolvedValue(1),
    zrangebyscore: vi.fn().mockResolvedValue([]),
    zremrangebyscore: vi.fn().mockResolvedValue(0),
    keys: vi.fn().mockResolvedValue([]),
    hget: vi.fn().mockResolvedValue(null),
    hgetall: vi.fn().mockResolvedValue({}),
    hset: vi.fn().mockResolvedValue(1),
    hdel: vi.fn().mockResolvedValue(1),
    del: vi.fn().mockResolvedValue(1),
  },
}))

// Create mock logger instance before vi.mock
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}

vi.mock('@/lib/utils/logger', async () => {
  return {
    getLogger: vi.fn(() => mockLogger),
    logger: mockLogger,
  }
})

vi.mock('@/lib/services/email/EmailService')

// Mock WebSocket constructor and methods
vi.mock('ws', () => {
  return {
    WebSocket: class {
      on = vi.fn().mockReturnThis()
      close = vi.fn()
      send = vi.fn()
      constructor() {
        // no-op
      }
    },
  }
})

// Typed mock redis: avoids unbound-method lint on vi.mocked(redis.method!) / expect(redis.method!)
const mockRedis = redis as unknown as {
  lpush: ReturnType<typeof vi.fn>
  rpoplpush: ReturnType<typeof vi.fn>
  hset: ReturnType<typeof vi.fn>
  hget: ReturnType<typeof vi.fn>
  hgetall: ReturnType<typeof vi.fn>
}

describe('notificationService', () => {
  let notificationService: NotificationService

  const mockTemplate = {
    id: 'test-template',
    title: 'Test Notification',
    body: 'This is a test notification for {{name}}',
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    priority: NotificationPriority.NORMAL,
  }

  const mockNotification = {
    userId: 'test-user',
    templateId: 'test-template',
    data: { name: 'Test User' },
  }

  // Helper function to check if a client exists for a user
  const hasClient = (service: NotificationService, userId: string): boolean => {
    return (
      service as unknown as NotificationServiceTestInterface
    ).wsClients.has(userId)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    notificationService = new NotificationService()

    // Spy on private methods
    vi.spyOn(
      notificationService as unknown as NotificationServiceTestInterface,
      'emailService',
      'get',
    ).mockReturnValue({
      upsertTemplate: vi.fn(),
      queueEmail: vi.fn(),
    })

    vi.spyOn(
      notificationService as unknown as NotificationServiceTestInterface,
      'deliverInApp',
    )
  })

  describe('registerTemplate', () => {
    it('should register a template successfully', async () => {
      await notificationService.registerTemplate(mockTemplate)

      // Check if email template was registered
      expect(
        (notificationService as unknown as NotificationServiceTestInterface)
          .emailService.upsertTemplate,
      ).toHaveBeenCalledWith({
        alias: mockTemplate.id,
        subject: mockTemplate.title,
        htmlBody: mockTemplate.body,
        from: config.email?.from?.() ?? 'noreply@example.com',
      })
    })

    it('should validate template data', async () => {
      const invalidTemplate = {
        id: 'test',
        title: 'Test',
        body: 'Test',
        channels: ['invalid'],
        priority: 'invalid',
      } as unknown as Parameters<typeof notificationService.registerTemplate>[0]

      await expect(
        notificationService.registerTemplate(invalidTemplate),
      ).rejects.toThrow()
    })
  })

  describe('queueNotification', () => {
    beforeEach(async () => {
      await notificationService.registerTemplate(mockTemplate)
    })

    it('should queue a notification successfully', async () => {
      const id = await notificationService.queueNotification(mockNotification)

      expect(id).toBeDefined()
      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'notification_queue',
        expect.stringContaining(mockNotification.userId),
      )
    })

    it('should validate notification data', async () => {
      const invalidNotification = {
        userId: 123,
        templateId: 'test',
        data: null,
      } as unknown as Parameters<
        typeof notificationService.queueNotification
      >[0]

      await expect(
        notificationService.queueNotification(invalidNotification),
      ).rejects.toThrow()
    })

    it('should throw error for non-existent template', async () => {
      const notification = {
        ...mockNotification,
        templateId: 'non-existent',
      }

      await expect(
        notificationService.queueNotification(notification),
      ).rejects.toThrow()
    })
  })

  describe('processQueue', () => {
    beforeEach(async () => {
      await notificationService.registerTemplate(mockTemplate)
    })

    it('should process queued notifications', async () => {
      // Mock queue item
      const queueItem = {
        id: 'test-id',
        userId: mockNotification.userId,
        templateId: mockTemplate.id,
        title: mockTemplate.title,
        body: mockTemplate.body,
        data: mockNotification.data,
        channels: mockTemplate.channels,
        priority: mockTemplate.priority,
        status: NotificationStatus.PENDING,
        createdAt: Date.now(),
        deliveredAt: null,
        readAt: null,
        error: null,
      }

      // Mock redis.rpoplpush to return one item then null
      vi.mocked(redis['rpoplpush'])
        .mockResolvedValueOnce(JSON.stringify(queueItem))
        .mockResolvedValueOnce(null)

      await notificationService.processQueue()

      expect(mockRedis.rpoplpush).toHaveBeenCalledWith(
        'notification_queue',
        'notification_processing',
      )
      expect(mockRedis.hset).toHaveBeenCalledWith(
        `notifications:${queueItem.userId}`,
        queueItem.id,
        expect.stringContaining(NotificationStatus.DELIVERED),
      )
    })

    it('should handle delivery errors', async () => {
      // Mock queue item
      const queueItem = {
        id: 'test-id',
        userId: mockNotification.userId,
        templateId: mockTemplate.id,
        title: mockTemplate.title,
        body: mockTemplate.body,
        data: mockNotification.data,
        channels: [NotificationChannel.PUSH], // Push is not implemented
        priority: mockTemplate.priority,
        status: NotificationStatus.PENDING,
        createdAt: Date.now(),
        deliveredAt: null,
        readAt: null,
        error: null,
      }

      // Mock redis.rpoplpush to return the item
      vi.mocked(redis['rpoplpush']).mockResolvedValueOnce(
        JSON.stringify(queueItem),
      )
      vi.spyOn(
        notificationService as unknown as NotificationServiceTestInterface,
        'deliverPush',
      ).mockRejectedValueOnce(new Error('Push delivery not supported'))

      await notificationService.processQueue()

      expect(mockRedis.hset).toHaveBeenCalledWith(
        `notifications:${queueItem.userId}`,
        queueItem.id,
        expect.stringContaining(NotificationStatus.FAILED),
      )
    })
  })

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      const notification = {
        id: 'test-id',
        userId: 'test-user',
        templateId: 'test-template',
        title: 'Test',
        body: 'Test',
        data: {},
        channels: [NotificationChannel.IN_APP],
        priority: NotificationPriority.NORMAL,
        status: NotificationStatus.DELIVERED,
        createdAt: Date.now(),
        deliveredAt: Date.now(),
        readAt: null,
        error: null,
      }

      mockRedis.hget.mockResolvedValueOnce(JSON.stringify(notification))

      await notificationService.markAsRead('test-user', 'test-id')

      expect(mockRedis.hset).toHaveBeenCalledWith(
        'notifications:test-user',
        'test-id',
        expect.stringContaining(NotificationStatus.READ),
      )
    })

    it('should throw error for non-existent notification', async () => {
      mockRedis.hget.mockResolvedValueOnce(null)

      await expect(
        notificationService.markAsRead('test-user', 'test-id'),
      ).rejects.toThrow()
    })
  })

  describe('getNotifications', () => {
    it('should return notifications for a user', async () => {
      const notifications = {
        'test-id-1': JSON.stringify({
          id: 'test-id-1',
          userId: 'test-user',
          templateId: mockTemplate.id,
          title: mockTemplate.title,
          body: mockTemplate.body,
          data: mockNotification.data,
          channels: mockTemplate.channels,
          priority: NotificationPriority.NORMAL,
          createdAt: Date.now(),
          deliveredAt: Date.now(),
          readAt: null,
          status: NotificationStatus.DELIVERED,
          error: null,
        }),
        'test-id-2': JSON.stringify({
          id: 'test-id-2',
          userId: 'test-user',
          templateId: mockTemplate.id,
          title: mockTemplate.title,
          body: mockTemplate.body,
          data: mockNotification.data,
          channels: mockTemplate.channels,
          priority: NotificationPriority.NORMAL,
          createdAt: Date.now() - 1000,
          deliveredAt: Date.now(),
          readAt: null,
          status: NotificationStatus.DELIVERED,
          error: null,
        }),
      }

      mockRedis.hgetall.mockResolvedValueOnce(notifications)

      const result = await notificationService.getNotifications('test-user')

      expect(result).toHaveLength(2)
      expect(result?.[0].id).toBe('test-id-1') // Most recent first
    })

    it('should handle pagination', async () => {
      const notifications = Object.fromEntries(
        Array.from({ length: 10 }, (_, i) => [
          `test-id-${i}`,
          JSON.stringify({
            id: `test-id-${i}`,
            userId: 'test-user',
            templateId: mockTemplate.id,
            title: mockTemplate.title,
            body: mockTemplate.body,
            data: mockNotification.data,
            channels: mockTemplate.channels,
            priority: NotificationPriority.NORMAL,
            createdAt: Date.now() - i * 1000,
            deliveredAt: Date.now(),
            readAt: null,
            status: NotificationStatus.DELIVERED,
            error: null,
          }),
        ]),
      )

      mockRedis.hgetall.mockResolvedValueOnce(notifications)

      const result = await notificationService.getNotifications(
        'test-user',
        5,
        2,
      )

      expect(result).toHaveLength(5)
      expect(result?.[0].id).toBe('test-id-2') // Offset by 2, limit 5
    })
  })

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      const notifications = {
        'test-id-1': JSON.stringify({
          id: 'test-id-1',
          userId: 'test-user',
          templateId: mockTemplate.id,
          title: mockTemplate.title,
          body: mockTemplate.body,
          data: mockNotification.data,
          channels: mockTemplate.channels,
          priority: NotificationPriority.NORMAL,
          createdAt: Date.now(),
          deliveredAt: Date.now(),
          readAt: null,
          status: NotificationStatus.DELIVERED,
          error: null,
        }),
        'test-id-2': JSON.stringify({
          id: 'test-id-2',
          userId: 'test-user',
          templateId: mockTemplate.id,
          title: mockTemplate.title,
          body: mockTemplate.body,
          data: mockNotification.data,
          channels: mockTemplate.channels,
          priority: NotificationPriority.NORMAL,
          createdAt: Date.now(),
          deliveredAt: Date.now(),
          readAt: Date.now(),
          status: NotificationStatus.READ,
          error: null,
        }),
        'test-id-3': JSON.stringify({
          id: 'test-id-3',
          userId: 'test-user',
          templateId: mockTemplate.id,
          title: mockTemplate.title,
          body: mockTemplate.body,
          data: mockNotification.data,
          channels: mockTemplate.channels,
          priority: NotificationPriority.NORMAL,
          createdAt: Date.now(),
          deliveredAt: Date.now(),
          readAt: null,
          status: NotificationStatus.DELIVERED,
          error: null,
        }),
      }

      mockRedis.hgetall.mockResolvedValueOnce(notifications)

      const count = await notificationService.getUnreadCount('test-user')

      expect(count).toBe(2)
    })
  })

  describe('webSocket integration', () => {
    it('should register and unregister WebSocket clients', () => {
      const ws = new WebSocket(null)
      const userId = 'test-user'

      notificationService.registerClient(userId, ws)
      expect(hasClient(notificationService, userId)).toBe(true)

      notificationService.unregisterClient(userId)
      expect(hasClient(notificationService, userId)).toBe(false)
    })

    it('should deliver in-app notifications via WebSocket', async () => {
      const ws = new WebSocket(null)
      const userId = 'test-user'

      notificationService.registerClient(userId, ws)

      const notification = {
        id: 'test-id',
        userId,
        templateId: 'test-template',
        title: 'Test',
        body: 'Test',
        data: {},
        channels: [NotificationChannel.IN_APP],
        priority: NotificationPriority.NORMAL,
        status: NotificationStatus.PENDING,
        createdAt: Date.now(),
        deliveredAt: null,
        readAt: null,
        error: null,
      }

      // Directly call the private method through the spy
      await (
        notificationService as unknown as NotificationServiceTestInterface
      ).deliverInApp(notification)

      expect(vi.spyOn(ws, 'send')).toHaveBeenCalledWith(
        expect.stringContaining(notification.id),
      )
    })
  })
})
