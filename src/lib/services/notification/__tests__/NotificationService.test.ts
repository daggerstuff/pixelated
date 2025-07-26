import { config } from '@/config/env.config'
import { redis } from '@/lib/services/redis'
import { WebSocket } from 'ws'
import {
  NotificationChannel,
  NotificationPriority,
  NotificationService,
  NotificationStatus,
} from '../NotificationService'

// Type for accessing private properties in tests
interface NotificationServiceTestInterface {
  wsClients: Map<string, WebSocket>
  emailService: {
    upsertTemplate: (template: unknown) => Promise<void>
  }
  deliverInApp: (notification: unknown) => Promise<void>
}

// Mock dependencies
vi.mock('@/lib/services/redis', () => ({
  redis: {
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
    WebSocket: vi.fn().mockImplementation(() => {
      return {
        on: vi.fn().mockReturnThis(),
        close: vi.fn(),
        send: vi.fn(),
      }
    }),
  }
})

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
        from: config.email?.from?.() || 'noreply@example.com',
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
      expect(redis.lpush).toHaveBeenCalledWith(
        'notification:queue',
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
      vi.mocked(redis.rpoplpush).mockImplementation(async () => {
        return JSON.stringify(queueItem)
      })

      await notificationService.processQueue()

      expect(redis.rpoplpush).toHaveBeenCalledWith(
        'notification:queue',
        'notification:processing',
      )
      expect(redis.hset).toHaveBeenCalledWith(
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
      vi.mocked(redis.rpoplpush).mockResolvedValueOnce(
        JSON.stringify(queueItem),
      )

      await notificationService.processQueue()

      expect(redis.hset).toHaveBeenCalledWith(
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

      vi.mocked(redis.hget).mockResolvedValueOnce(JSON.stringify(notification))

      await notificationService.markAsRead('test-user', 'test-id')

      expect(redis.hset).toHaveBeenCalledWith(
        'notifications:test-user',
        'test-id',
        expect.stringContaining(NotificationStatus.READ),
      )
    })

    it('should throw error for non-existent notification', async () => {
      vi.mocked(redis.hget).mockResolvedValueOnce(null)

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
          createdAt: Date.now(),
        }),
        'test-id-2': JSON.stringify({
          id: 'test-id-2',
          createdAt: Date.now() - 1000,
        }),
      }

      vi.mocked(redis.hgetall).mockResolvedValueOnce(notifications)

      const result = await notificationService.getNotifications('test-user')

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('test-id-1') // Most recent first
    })

    it('should handle pagination', async () => {
      const notifications = Object.fromEntries(
        Array.from({ length: 10 }, (_, i) => [
          `test-id-${i}`,
          JSON.stringify({
            id: `test-id-${i}`,
            createdAt: Date.now() - i * 1000,
          }),
        ]),
      )

      vi.mocked(redis.hgetall).mockResolvedValueOnce(notifications)

      const result = await notificationService.getNotifications(
        'test-user',
        5,
        2,
      )

      expect(result).toHaveLength(5)
      expect(result[0].id).toBe('test-id-2') // Offset by 2, limit 5
    })
  })

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      const notifications = {
        'test-id-1': JSON.stringify({
          id: 'test-id-1',
          status: NotificationStatus.DELIVERED,
        }),
        'test-id-2': JSON.stringify({
          id: 'test-id-2',
          status: NotificationStatus.READ,
        }),
        'test-id-3': JSON.stringify({
          id: 'test-id-3',
          status: NotificationStatus.DELIVERED,
        }),
      }

      vi.mocked(redis.hgetall).mockResolvedValueOnce(notifications)

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

      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining(notification.id),
      )
    })
  })
})
