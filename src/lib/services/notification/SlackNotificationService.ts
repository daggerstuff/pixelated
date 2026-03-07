import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import type {
  CrisisAlertContext,
  ICrisisNotificationHandler,
} from './NotificationService'
import { config } from '@/config/env.config' // For accessing Slack webhook URL

const logger = createBuildSafeLogger('SlackNotificationService')

interface SlackBlock {
  type: string
  text?: {
    type: string
    text: string
    emoji?: boolean
  }
  fields?: Array<{
    type: string
    text: string
  }>
  elements?: Array<{
    type: string
    text?: string
  }>
  accessory?: {
    type: string
    image_url: string
    alt_text: string
  }
}

interface SlackMessagePayload {
  text: string // Fallback text for notifications
  blocks: SlackBlock[]
  username?: string
  icon_emoji?: string
  channel?: string // Optional: can be set in webhook settings or here
}

export class SlackNotificationService implements ICrisisNotificationHandler {
  private webhookUrl: string

  constructor(webhookUrl?: string) {
    const url = webhookUrl || config.notifications.slackWebhookUrl()
    if (!url) {
      const errorMsg =
        'Slack webhook URL is not configured. SlackNotificationService cannot operate.'
      logger.error(errorMsg)
      throw new Error(errorMsg)
    }
    this.webhookUrl = url
    logger.info('SlackNotificationService initialized.')
  }

  private formatCrisisAlertToSlack(
    alertContext: CrisisAlertContext,
  ): SlackMessagePayload {
    const {
      userId,
      sessionId,
      sessionType,
      explicitTaskHint,
      timestamp,
      textSample,
      decisionDetails,
    } = alertContext

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 CRITICAL CRISIS ALERT 🚨',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `A potential user crisis was detected by the MentalLLaMA system. *Urgent review required.*`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Timestamp:*\n${new Date(timestamp).toLocaleString()}`,
          },
          { type: 'mrkdwn', text: `*User ID:*\n${userId || 'N/A'}` },
          { type: 'mrkdwn', text: `*Session ID:*\n${sessionId || 'N/A'}` },
          { type: 'mrkdwn', text: `*Session Type:*\n${sessionType || 'N/A'}` },
          {
            type: 'mrkdwn',
            text: `*Explicit Task Hint:*\n${typeof explicitTaskHint === 'string' ? explicitTaskHint : 'N/A'}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Text Sample (first 500 chars):*\n\`\`\`${textSample}\`\`\``,
        },
      },
    ]

    if (decisionDetails) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Routing Decision Details:*\n\`\`\`${JSON.stringify(decisionDetails, null, 2)}\`\`\``,
        },
      })
    }

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `This alert was generated at ${new Date().toISOString()}. Please investigate immediately.`,
        },
      ],
    })

    return {
      text: `CRITICAL CRISIS ALERT: User ID ${userId || 'N/A'}, Session ID ${sessionId || 'N/A'}. Urgent review required.`,
      blocks,
      username: 'MentalLLaMA Crisis Monitor',
      icon_emoji: ':rotating_light:',
      // channel: '#crisis-alerts', // Can be set here or in webhook config
    }
  }

  async sendCrisisAlert(alertContext: CrisisAlertContext): Promise<void> {
    logger.warn('Dispatching crisis alert via SlackNotificationService:', {
      userId: alertContext.userId,
      sessionId: alertContext.sessionId,
      timestamp: alertContext.timestamp,
    })

    const slackPayload = this.formatCrisisAlertToSlack(alertContext)

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(slackPayload),
      })

      if (!response.ok) {
        const responseBody = await response.text()
        logger.error('Failed to send Slack crisis alert. Non-OK response.', {
          statusCode: response.status,
          statusText: response.statusText,
          responseBody,
          webhookUrl:
            this.webhookUrl.substring(
              0,
              this.webhookUrl.indexOf('/services/') + '/services/'.length,
            ) + '...', // Log only part of URL
        })
        throw new Error(
          `Slack API error: ${response.status} ${response.statusText} - ${responseBody}`,
        )
      }
      logger.info('Crisis alert successfully sent to Slack.', {
        userId: alertContext.userId,
        sessionId: alertContext.sessionId,
      })
    } catch (error: unknown) {
      logger.error('Exception while sending Slack crisis alert:', {
        error: error instanceof Error ? String(error) : String(error),
        stack: error instanceof Error ? (error as Error)?.stack : undefined,
        webhookUrl:
          this.webhookUrl.substring(
            0,
            this.webhookUrl.indexOf('/services/') + '/services/'.length,
          ) + '...',
      })
      // Rethrow to indicate failure to dispatch, allowing caller (MentalLLaMAAdapter) to handle
      throw new Error(
        `Failed to dispatch crisis alert via SlackNotificationService: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    }
  }
}
