import { config as env } from '@/config/env.config'
import { redis } from '@/lib/services/redis'

import { createBuildSafeLogger } from '../../logging/build-safe-logger'

// Service-scoped logger
const logger = createBuildSafeLogger('EmailService')

import { Resend } from 'resend'
import { z } from 'zod'

// Email template schema
const EmailTemplateSchema = z.object({
  alias: z.string(),
  subject: z.string(),
  htmlBody: z.string(),
  textBody: z.string().optional(),
  from: z.string().email(),
  replyTo: z.string().email().optional(),
})

type EmailTemplate = z.infer<typeof EmailTemplateSchema>

// Email data schema
const EmailDataSchema = z.object({
  to: z.string().email(),
  templateAlias: z.string(),
  templateModel: z.record(z.unknown()),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        content: z.string(),
        contentType: z.string(),
      }),
    )
    .optional(),
  metadata: z.record(z.string()).optional(),
  messageStream: z.string().optional(),
})

type EmailData = z.infer<typeof EmailDataSchema>

// Email queue item schema
const EmailQueueItemSchema = z.object({
  id: z.string(),
  data: EmailDataSchema,
  attempts: z.number(),
  lastAttempt: z.number().nullable(),
  error: z.string().nullable(),
})

type EmailQueueItem = z.infer<typeof EmailQueueItemSchema>

export class EmailService {
  private resend: Resend
  private isEnabled = false
  private queueKey = 'email:queue'
  private processingKey = 'email:processing'
  private maxAttempts = 3
  private retryDelays = [60, 300, 900] // 1min, 5min, 15min
  private templates = new Map<string, EmailTemplate>()
  private isShuttingDown = false

  constructor() {
    const apiKey = env.email.resendApiKey()
    if (!apiKey) {
      // Do not throw; run in disabled mode so upstream APIs don't 500
      this.isEnabled = false
      // @ts-expect-error - initialized later only when enabled
      this.resend = undefined
      logger.warn(
        'Email service is disabled: missing RESEND_API_KEY. Emails will be skipped.',
      )
      return
    }
    this.isEnabled = true
    this.resend = new Resend(apiKey)
  }

  /**
   * Queue an email for sending
   */
  async queueEmail(data: EmailData): Promise<string> {
    // Validate email data
    EmailDataSchema.parse(data)

    // If service is disabled, do not queue. Return a synthetic id and log.
    if (!this.isEnabled) {
      const id = crypto.randomUUID()
      logger.info('Email skipped (service disabled)', {
        id,
        to: data.to,
        templateAlias: data.templateAlias,
      })
      return id
    }

    // Create queue item
    const queueItem: EmailQueueItem = {
      id: crypto.randomUUID(),
      data,
      attempts: 0,
      lastAttempt: null,
      error: null,
    }

    // Add to queue
    await redis.lpush(this.queueKey, JSON.stringify(queueItem))

    logger.info('Email queued', {
      id: queueItem.id,
      to: data.to,
      templateAlias: data.templateAlias,
    })

    return queueItem.id
  }

  /**
   * Process the email queue
   */
  async processQueue(): Promise<void> {
    if (!this.isEnabled) {
      // Nothing to process in disabled mode
      return
    }
    while (true) {
      // Move item from queue to processing
      const item = await redis.rpoplpush(this.queueKey, this.processingKey)
      if (!item) {
        break
      }

      const queueItem = EmailQueueItemSchema.parse(JSON.parse(item) as unknown)

      try {
        // Check if we should retry based on last attempt and delay
        if (queueItem.lastAttempt) {
          const delay =
            this.retryDelays[queueItem.attempts - 1] ??
            this.retryDelays[this.retryDelays.length - 1]
          if (delay === undefined) {
            throw new Error('Failed to determine retry delay')
          }
          const nextAttempt = queueItem.lastAttempt + delay * 1000
          if (Date.now() < nextAttempt) {
            // Put back in queue and continue
            await redis.lpush(this.queueKey, item)
            await redis.lrem(this.processingKey, 1, item)
            continue
          }
        }

        const template = this.templates.get(queueItem.data.templateAlias)
        if (!template) {
          throw new Error(`Template ${queueItem.data.templateAlias} not found`)
        }

        // Replace template variables
        let html = template.htmlBody
        let text = template.textBody
        for (const [key, value] of Object.entries(
          queueItem.data.templateModel,
        )) {
          const regex = new RegExp(`{{${key}}}`, 'g')
          html = html.replace(regex, String(value))
          if (text) {
            text = text.replace(regex, String(value))
          }
        }

        // Prepare email options with proper typing for Resend API
        const emailOptions = {
          from: template.from,
          to: queueItem.data.to,
          subject: template.subject,
          html,
          // Ensure text is either a string or omitted (not undefined)
          ...(text && { text }),
          // Only include replyTo if it exists
          ...(template.replyTo && { replyTo: template.replyTo }),
          // Add attachments if present
          ...(queueItem.data.attachments?.length && {
            attachments: queueItem.data.attachments.map((att) => ({
              filename: att.name,
              content: att.content,
              content_type: att.contentType,
            })),
          }),
        }

        // Send email using Resend
        const { data, error } = await this.resend.emails.send(emailOptions)

        if (error) {
          throw error
        }

        // Remove from processing queue on success
        await redis.lrem(this.processingKey, 1, item)

        logger.info('Email sent successfully', {
          id: queueItem.id,
          to: queueItem.data.to,
          templateAlias: queueItem.data.templateAlias,
          attempts: queueItem.attempts + 1,
          resendId: data?.id,
        })
      } catch (error: unknown) {
        // Update attempts and error
        queueItem.attempts++
        queueItem.lastAttempt = Date.now()
        queueItem.error = error instanceof Error ? String(error) : String(error)

        if (queueItem.attempts >= this.maxAttempts) {
          // Log failure and remove from processing
          logger.error('Email sending failed permanently', {
            id: queueItem.id,
            to: queueItem.data.to,
            templateAlias: queueItem.data.templateAlias,
            error: queueItem.error,
            attempts: queueItem.attempts,
          })
          await redis.lrem(this.processingKey, 1, item)
        } else {
          // Put back in queue for retry
          await redis.lpush(this.queueKey, JSON.stringify(queueItem))
          await redis.lrem(this.processingKey, 1, item)

          logger.warn('Email sending failed, will retry', {
            id: queueItem.id,
            to: queueItem.data.to,
            templateAlias: queueItem.data.templateAlias,
            error: queueItem.error,
            attempts: queueItem.attempts,
          })
        }
      }
    }
  }

  /**
   * Create or update an email template
   */
  async upsertTemplate(template: EmailTemplate): Promise<void> {
    // Validate template
    EmailTemplateSchema.parse(template)

    // Store template in memory
    this.templates.set(template.alias, template)

    logger.info('Email template updated', {
      alias: template.alias,
    })
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [queueLength, processingLength] = await Promise.all([
      redis.llen(this.queueKey),
      redis.llen(this.processingKey),
    ])

    return {
      queued: queueLength,
      processing: processingLength,
    }
  }

  /**
   * Start queue processing
   */
  async startProcessing(interval = 1000): Promise<void> {
    while (!this.isShuttingDown) {
      await this.processQueue()
      await new Promise((resolve) => setTimeout(resolve, interval))
    }
  }
}
