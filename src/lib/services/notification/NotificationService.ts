import type { WebSocket } from 'ws'
import { config } from '@/config/env.config'
import { EmailService, type EmailConfig } from '@/lib/email'
import { redis } from '@/lib/redis'
import type { IRedisService } from '../redis/types'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import type { RoutingContext } from '@/lib/ai/mental-llama/routing/MentalHealthTaskRouter'
import { z } from 'zod'
import { generateVAPIDKeys, sendNotification } from './pushUtils'
import type { PushSubscription } from './pushUtils'
import { sendSMS, isValidPhoneNumber } from './smsUtils'

// Create a logger instance
const logger = createBuildSafeLogger('NotificationService')

// Crisis Alert Template ID
const CRISIS_ALERT_TEMPLATE_ID = 'crisis_alert_v1'

// Notification channel types
export const NotificationChannel = {
  IN_APP: 'in_app',
  PUSH: 'push',
  EMAIL: 'email',
  SMS: 'sms',
} as const

// Notification priority levels
export const NotificationPriority = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
} as const

// Notification status types
export const NotificationStatus = {
  PENDING: 'pending',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  READ: 'read',
} as const

// Notification template schema
const NotificationTemplateSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  channels: z.array(
    z.enum([
      NotificationChannel.IN_APP,
      NotificationChannel.PUSH,
      NotificationChannel.EMAIL,
      NotificationChannel.SMS,
    ]),
  ),
  priority: z.enum([
    NotificationPriority.LOW,
    NotificationPriority.NORMAL,
    NotificationPriority.HIGH,
    NotificationPriority.URGENT,
  ]),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

type NotificationTemplate = z.infer<typeof NotificationTemplateSchema>

// Notification data schema
const NotificationDataSchema = z.object({
  userId: z.string(),
  templateId: z.string(),
  data: z.record(z.string(), z.unknown()),
  channels: z
    .array(
      z.enum([
        NotificationChannel.IN_APP,
        NotificationChannel.PUSH,
        NotificationChannel.EMAIL,
        NotificationChannel.SMS,
      ]),
    )
    .optional(),
  priority: z
    .enum([
      NotificationPriority.LOW,
      NotificationPriority.NORMAL,
      NotificationPriority.HIGH,
      NotificationPriority.URGENT,
    ])
    .optional(),
})

type NotificationData = z.infer<typeof NotificationDataSchema>

// Notification item schema
const NotificationItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  templateId: z.string(),
  title: z.string(),
  body: z.string(),
  data: z.record(z.string(), z.unknown()),
  channels: z.array(
    z.enum([
      NotificationChannel.IN_APP,
      NotificationChannel.PUSH,
      NotificationChannel.EMAIL,
      NotificationChannel.SMS,
    ]),
  ),
  priority: z.enum([
    NotificationPriority.LOW,
    NotificationPriority.NORMAL,
    NotificationPriority.HIGH,
    NotificationPriority.URGENT,
  ]),
  status: z.enum([
    NotificationStatus.PENDING,
    NotificationStatus.DELIVERED,
    NotificationStatus.FAILED,
    NotificationStatus.READ,
  ]),
  createdAt: z.number(),
  deliveredAt: z.number().nullable(),
  readAt: z.number().nullable(),
  error: z.string().nullable(),
})

type NotificationItem = z.infer<typeof NotificationItemSchema>

// Export the NotificationItem type
export type { NotificationItem }

/**
 * Defines the context for a crisis alert.
 */
export interface CrisisAlertContext extends RoutingContext {
  timestamp: string // ISO 8601 timestamp
  textSample: string // A sample of the text that triggered the crisis
  decisionDetails?: Record<string, unknown> // Details from the routing decision
  userId: string
  sessionId: string
  sessionType: string
  explicitTaskHint: string
}

/**
 * Interface for a service that handles sending notifications,
 * particularly for critical events like crisis alerts.
 */
export interface ICrisisNotificationHandler {
  /**
   * Sends a crisis alert.
   *
   * @param alertContext Contextual information about the crisis.
   * @returns Promise<void> Resolves when the alert has been dispatched, or rejects on failure.
   * @throws Error if the notification dispatch fails and cannot be handled gracefully.
   */
  sendCrisisAlert(alertContext: CrisisAlertContext): Promise<void>

  // Potentially other notification methods can be added here, e.g.:
  // sendSystemNotification(message: string, level: 'info' | 'warn' | 'error'): Promise<void>;
}

export class NotificationService {
  private emailService: EmailService
  private wsClients: Map<string, WebSocket>
  private templates: Map<string, NotificationTemplate>
  private vapidKeys: { publicKey: string; privateKey: string } | null = null
  private readonly queueKey = 'notification_queue'
  private readonly processingKey = 'notification_processing'
  private readonly subscriptionKey = 'push_subscriptions'

  constructor() {
    const emailConfig: EmailConfig = {
      provider: 'smtp',
      fromEmail: config.email.from() || 'noreply@example.com',
      fromName: 'Pixelated Empathy',
      smtpHost: process.env['SMTP_HOST'],
      smtpPort: Number.parseInt(process.env['SMTP_PORT'] || '587'),
      smtpUser: process.env['SMTP_USER'],
      smtpPassword: process.env['SMTP_PASSWORD'],
      apiKey: process.env['EMAIL_API_KEY'],
    }
    this.emailService = new EmailService(emailConfig)
    this.wsClients = new Map()
    this.templates = new Map()
    this.initializeVAPIDKeys()
    this.initializeCrisisTemplate() // Ensure crisis template is set up
  }

  private async initializeVAPIDKeys() {
    // Try to get existing VAPID keys from config
    const publicKey = config.notifications.vapidPublicKey()
    const privateKey = config.notifications.vapidPrivateKey()

    if (publicKey && privateKey) {
      this.vapidKeys = { publicKey, privateKey }
    } else {
      // Generate new VAPID keys if not configured
      this.vapidKeys = await generateVAPIDKeys()
      logger.info('Generated new VAPID keys')
    }
  }

  private async initializeCrisisTemplate(): Promise<void> {
    if (!this.templates.has(CRISIS_ALERT_TEMPLATE_ID)) {
      // adminEmail may not be present on config.notifications type, but is expected here.
      // @ts-expect-error - adminEmail may not be typed in config.notifications, but is expected at runtime.
      const adminEmail = config.notifications.adminEmail?.()
      if (!adminEmail) {
        logger.warn(
          'Admin email not configured. Crisis email alerts will not be sent by default template.',
        )
      }
      const crisisTemplate: NotificationTemplate = {
        id: CRISIS_ALERT_TEMPLATE_ID,
        title: 'CRITICAL ALERT: Potential Crisis Detected',
        // Body can be simple, actual details will be in the data payload
        body: 'A potential user crisis has been detected by the MentalLLaMA system. Urgent review required. Details: {{textSample}} UserID: {{userId}} SessionID: {{sessionId}} Timestamp: {{timestamp}}',
        channels: adminEmail ? [NotificationChannel.EMAIL] : [], // Add other channels like SMS if admin phone is configured
        priority: NotificationPriority.URGENT,
        metadata: { isCrisisAlert: true },
      }
      try {
        await this.registerTemplate(crisisTemplate)
        logger.info(
          `Default crisis alert template '${CRISIS_ALERT_TEMPLATE_ID}' registered.`,
        )
      } catch (error: unknown) {
        logger.error(
          `Failed to register default crisis alert template: ${CRISIS_ALERT_TEMPLATE_ID}`,
          { error },
        )
      }
    }
  }

  /**
   * Register a WebSocket client for a user
   */
  registerClient(userId: string, ws: WebSocket): void {
    // Clean up any existing connection
    const existingWs = this.wsClients.get(userId)
    if (existingWs) {
      existingWs.close()
      this.wsClients.delete(userId)
    }

    // Register new connection
    this.wsClients.set(userId, ws)

    // Handle cleanup on close
    ws.on('close', () => {
      // Only delete if this is still the registered client
      if (this.wsClients.get(userId) === ws) {
        this.wsClients.delete(userId)
      }
    })
  }

  /**
   * Unregister a WebSocket client for a user
   */
  unregisterClient(userId: string): void {
    const ws = this.wsClients.get(userId)
    if (ws) {
      ws.close()
      this.wsClients.delete(userId)
    }
  }

  /**
   * Register a notification template
   */
  async registerTemplate(template: NotificationTemplate): Promise<void> {
    // Validate template
    NotificationTemplateSchema.parse(template)

    // Store template
    this.templates.set(template.id, template)

    // If template includes email channel, register email template
    if (template.channels.includes(NotificationChannel.EMAIL)) {
      await this.emailService.upsertTemplate({
        alias: template.id,
        subject: template.title,
        htmlBody: template.body,
        from: config.email.from() || 'noreply@example.com',
      })
    }
  }

  /**
   * Queue a notification for delivery
   */
  async queueNotification(data: NotificationData): Promise<string> {
    // Validate notification data
    NotificationDataSchema.parse(data)

    // Get template
    const template = this.templates.get(data.templateId)
    if (!template) {
      throw new Error(`Template ${data.templateId} not found`)
    }

    // Create notification item
    const notification: NotificationItem = {
      id: crypto.randomUUID(),
      userId: data.userId,
      templateId: data.templateId,
      title: template.title,
      body: template.body,
      data: data.data,
      channels: data.channels || template.channels,
      priority: data.priority || template.priority,
      status: NotificationStatus.PENDING,
      createdAt: Date.now(),
      deliveredAt: null,
      readAt: null,
      error: null,
    }

    // Add to queue
    await (redis as unknown as IRedisService).lpush(
      this.queueKey,
      JSON.stringify(notification),
    )

    logger.info('Notification queued', {
      id: notification.id,
      userId: notification.userId,
      templateId: notification.templateId,
      channels: notification.channels,
    })

    return notification.id
  }

  /**
   * Process the notification queue
   */
  async processQueue(): Promise<void> {
    while (true) {
      // Move item from queue to processing
      const item = await (redis as unknown as IRedisService).rpoplpush(
        this.queueKey,
        this.processingKey,
      )
      if (!item) {
        break
      }

      const notification = NotificationItemSchema.parse(
        JSON.parse(item) as unknown,
      )

      try {
        // Process each channel
        for (const channel of notification.channels) {
          switch (channel) {
            case NotificationChannel.IN_APP:
              await this.deliverInApp(notification)
              break
            case NotificationChannel.PUSH:
              await this.deliverPush(notification)
              break
            case NotificationChannel.EMAIL:
              await this.deliverEmail(notification)
              break
            case NotificationChannel.SMS:
              await this.deliverSMS(notification)
              break
          }
        }

        // Update status
        notification.status = NotificationStatus.DELIVERED
        notification.deliveredAt = Date.now()

        // Store delivered notification
        await (redis as unknown as IRedisService).hset(
          `notifications:${notification.userId}`,
          notification.id,
          JSON.stringify(notification),
        )

        // Remove from processing queue
        await (redis as unknown as IRedisService).lrem(
          this.processingKey,
          1,
          item,
        )

        logger.info('Notification delivered', {
          id: notification.id,
          userId: notification.userId,
          templateId: notification.templateId,
          channels: notification.channels,
        })
      } catch (error: unknown) {
        // Update status and error
        notification.status = NotificationStatus.FAILED
        notification.error =
          error instanceof Error ? String(error) : String(error)

        // Store failed notification
        await (redis as unknown as IRedisService).hset(
          `notifications:${notification.userId}`,
          notification.id,
          JSON.stringify(notification),
        )

        // Remove from processing queue
        await (redis as unknown as IRedisService).lrem(
          this.processingKey,
          1,
          item,
        )

        logger.error('Notification delivery failed', {
          id: notification.id,
          userId: notification.userId,
          templateId: notification.templateId,
          channels: notification.channels,
          error: notification.error,
        })
      }
    }
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const notification = await (redis as unknown as IRedisService).hget(
      `notifications:${userId}`,
      notificationId,
    )
    if (!notification) {
      throw new Error('Notification not found')
    }

    const parsed = NotificationItemSchema.parse(
      JSON.parse(notification as string) as NotificationItem,
    )
    parsed.status = NotificationStatus.READ
    parsed.readAt = Date.now()

    await redis.hset(
      `notifications:${userId}`,
      notificationId,
      JSON.stringify(parsed),
    )
  }

  /**
   * Get notifications for a user
   */
  async getNotifications(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<NotificationItem[]> {
    const notifications = await (redis as unknown as IRedisService).hgetall(
      `notifications:${userId}`,
    )
    if (!notifications) {
      return []
    }

    return Object.values(notifications)
      .map((n) =>
        NotificationItemSchema.parse(
          JSON.parse(n as string) as NotificationItem,
        ),
      )
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(offset, offset + limit)
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    const notifications = await (redis as unknown as IRedisService).hgetall(
      `notifications:${userId}`,
    )
    if (!notifications) {
      return 0
    }

    return Object.values(notifications)
      .map((n) =>
        NotificationItemSchema.parse(
          JSON.parse(n as string) as NotificationItem,
        ),
      )
      .filter((n) => n.status !== NotificationStatus.READ).length
  }

  /**
   * Deliver notification via WebSocket
   */
  private async deliverInApp(notification: NotificationItem): Promise<void> {
    const ws = this.wsClients.get(notification.userId)
    if (!ws) {
      return
    }

    ws.send(
      JSON.stringify({
        type: 'notification',
        data: notification,
      }),
    )
  }

  /**
   * Store a push subscription for a user
   */
  async storePushSubscription(
    userId: string,
    subscription: PushSubscription,
  ): Promise<void> {
    await (redis as unknown as IRedisService).hset(
      this.subscriptionKey,
      userId,
      JSON.stringify(subscription),
    )
    logger.info('Push subscription stored', { userId })
  }

  /**
   * Remove a push subscription for a user
   */
  async removePushSubscription(userId: string): Promise<void> {
    await (redis as unknown as IRedisService).hdel(this.subscriptionKey, userId)
    logger.info('Push subscription removed', { userId })
  }

  /**
   * Get a user's push subscription
   */
  private async getPushSubscription(
    userId: string,
  ): Promise<PushSubscription | null> {
    const subscription = await (redis as unknown as IRedisService).hget(
      this.subscriptionKey,
      userId,
    )
    if (!subscription) {
      return null
    }
    return JSON.parse(subscription as string) as PushSubscription | null
  }

  /**
   * Deliver notification via Web Push
   */
  private async deliverPush(notification: NotificationItem): Promise<void> {
    if (!this.vapidKeys) {
      logger.warn('Push notification skipped - VAPID keys not initialized')
      return
    }

    const subscription = await this.getPushSubscription(notification.userId)
    if (!subscription) {
      logger.info('No push subscription found for user', {
        userId: notification.userId,
      })
      return
    }

    try {
      const payload = {
        title: notification.title,
        body: notification.body,
        data: notification.data,
        timestamp: notification.createdAt,
        notificationId: notification.id,
        icon: '/icon.png',
        badge: '/badge.png',
        tag: notification.id,
      }

      await sendNotification(subscription, payload, this.vapidKeys)

      logger.info('Push notification sent', {
        userId: notification.userId,
        notificationId: notification.id,
      })
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error as Error)?.name === 'ExpiredSubscriptionError'
      ) {
        await this.removePushSubscription(notification.userId)
        logger.info('Removed expired push subscription', {
          userId: notification.userId,
        })
      } else {
        logger.error('Failed to send push notification', {
          userId: notification.userId,
          notificationId: notification.id,
          error: error instanceof Error ? String(error) : String(error),
        })
        throw error
      }
    }
  }

  /**
   * Deliver notification via Email
   */
  private async deliverEmail(notification: NotificationItem): Promise<void> {
    await this.emailService.queueEmail({
      to: notification.userId, // Assuming userId is email address
      templateAlias: notification.templateId,
      templateModel: notification.data,
    })
  }

  /**
   * Deliver notification via SMS
   */
  private async deliverSMS(notification: NotificationItem): Promise<void> {
    // Validate phone number format (assuming userId is the phone number for SMS)
    if (!isValidPhoneNumber(notification.userId)) {
      throw new Error('Invalid phone number format')
    }

    // Construct the message
    const message = `${notification.title}\n\n${notification.body}`

    // Send the SMS
    await sendSMS(notification.userId, message)

    logger.info('SMS notification sent', {
      to: notification.userId,
      notificationId: notification.id,
    })
  }

  /**
   * Sends a crisis alert by formatting it and queuing it through the standard notification pipeline.
   *
   * @param alertContext Contextual information about the crisis.
   * @throws Error if queuing the notification fails.
   */
  async sendCrisisAlert(alertContext: CrisisAlertContext): Promise<void> {
    logger.warn('Dispatching crisis alert via NotificationService:', {
      userId: alertContext.userId,
      sessionId: alertContext.sessionId,
      timestamp: alertContext.timestamp,
    })

    const {
      userId,
      sessionId,
      sessionType,
      explicitTaskHint,
      timestamp,
      textSample,
      decisionDetails,
    } = alertContext

    const notificationData: NotificationData = {
      // For system alerts like crisis, userId might be an admin or a system user ID.
      // Or, if it's about a specific user, use their ID for context, but the notification itself goes to admins.
      // For this implementation, let's assume the template handles targeting admins.
      // If no specific admin user ID, we rely on the template's channel configuration (e.g., admin email).
      userId: userId || 'system_crisis_monitoring', // Use provided userId or fallback
      templateId: CRISIS_ALERT_TEMPLATE_ID,
      data: {
        userId: userId || 'N/A',
        sessionId: sessionId || 'N/A',
        sessionType: sessionType || 'N/A',
        explicitTaskHint:
          typeof explicitTaskHint === 'string' ? explicitTaskHint : 'N/A',
        timestamp,
        textSample,
        decisionDetails: JSON.stringify(decisionDetails) || 'N/A',
        // Add any other critical pieces of information from alertContext
      },
      priority: NotificationPriority.URGENT, // Ensure it's marked as urgent
      // Channels can be overridden here if needed, but typically template defines them
    }

    try {
      const notificationId = await this.queueNotification(notificationData)
      logger.info(
        `Crisis alert queued successfully. Notification ID: ${notificationId}`,
        { userId, sessionId },
      )
    } catch (error: unknown) {
      logger.error('Failed to queue crisis alert notification.', {
        error,
        alertContext,
      })
      // Rethrow to indicate failure to dispatch, allowing caller to handle
      throw new Error(
        'Failed to dispatch crisis alert via NotificationService.',
        { cause: error },
      )
    }
  }
}

/**
 * Example implementation or placeholder for a NotificationService.
 * In a real application, this would integrate with an actual notification system
 * (e.g., email, SMS, PagerDuty, Slack, dedicated monitoring dashboard).
 */
export class ConsoleNotificationService implements ICrisisNotificationHandler {
  private logger = console // Or use a more sophisticated logger

  async sendCrisisAlert(alertContext: CrisisAlertContext): Promise<void> {
    this.logger.error(
      'CRISIS ALERT DISPATCHED (ConsoleNotificationService):',
      JSON.stringify(alertContext, null, 2),
    )
    // In a real implementation, this would make an API call, send an email, etc.
    // For example:
    // await sendToPagerDuty({ ... });
    // await sendEmailToAdmin({ ... });

    // Simulate potential failure for robustness testing
    // if (Math.random() < 0.1) { // 10% chance of failure
    //   throw new Error('Simulated failure sending crisis alert via console.');
    // }
  }
}
