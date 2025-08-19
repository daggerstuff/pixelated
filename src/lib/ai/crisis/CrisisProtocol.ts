import type {
  CrisisProtocolConfig,
  AlertConfiguration,
  CrisisEvent,
} from './types'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const appLogger = createBuildSafeLogger('app')

export class CrisisProtocol {
  private static instance: CrisisProtocol | null = null
  private config: CrisisProtocolConfig | null = null
  private activeEvents: Map<string, CrisisEvent> = new Map()
  private alertTimers: Map<string, NodeJS.Timeout> = new Map()

  private constructor() {
    // Singleton pattern
  }

  static getInstance(): CrisisProtocol {
    if (!CrisisProtocol.instance) {
      CrisisProtocol.instance = new CrisisProtocol()
    }
    return CrisisProtocol.instance
  }

  initialize(config: CrisisProtocolConfig): void {
    this.config = config
    appLogger.info('Crisis Protocol initialized with', {
      alertConfigurations: config.alertConfigurations.length,
      staffChannels: Object.keys(config.staffChannels).length,
      slackEnabled: !!config.slackWebhookUrl,
    })
  }

  async handleCrisis(
    userId: string,
    sessionId: string,
    content: string,
    confidence: number,
    detectedRisks: string[],
  ): Promise<void> {
    if (!this.config) {
      throw new Error('Crisis Protocol not initialized')
    }

    try {
      // Determine alert level based on confidence and detected risks
      const alertLevel = this.determineAlertLevel(confidence, detectedRisks)
      const alertConfig = this.getAlertConfiguration(alertLevel)

      if (!alertConfig) {
        appLogger.warn(`No alert configuration found for level: ${alertLevel}`)
        return
      }

      // Create crisis event
      const crisisEvent: CrisisEvent = {
        id: crypto.randomUUID(),
        userId,
        sessionId,
        timestamp: new Date().toISOString(),
        content,
        confidence,
        detectedRisks,
        alertLevel,
        escalated: false,
        resolved: false,
      }

      // Store event
      this.activeEvents.set(crisisEvent.id, crisisEvent)

      // Record event to database
      await this.config.crisisEventRecorder({
        id: crisisEvent.id,
        userId: crisisEvent.userId,
        sessionId: crisisEvent.sessionId,
        timestamp: crisisEvent.timestamp,
        content: crisisEvent.content,
        confidence: crisisEvent.confidence,
        detectedRisks: crisisEvent.detectedRisks,
        alertLevel: crisisEvent.alertLevel,
        escalated: crisisEvent.escalated,
        resolved: crisisEvent.resolved,
      })

      // Send notifications to staff
      await this.notifyStaff(crisisEvent, alertConfig)

      // Set up auto-escalation if configured
      if (alertConfig.autoEscalateAfterMs > 0) {
        this.scheduleAutoEscalation(crisisEvent, alertConfig)
      }

      appLogger.info('Crisis event handled', {
        eventId: crisisEvent.id,
        userId,
        alertLevel,
        confidence,
      })
    } catch (error: unknown) {
      appLogger.error('Error handling crisis event:', error)
      throw error
    }
  }

  async escalateEvent(eventId: string, handledBy: string): Promise<void> {
    const event = this.activeEvents.get(eventId)
    if (!event) {
      throw new Error(`Crisis event not found: ${eventId}`)
    }

    event.escalated = true
    event.handledBy = handledBy

    // Clear auto-escalation timer
    const timer = this.alertTimers.get(eventId)
    if (timer) {
      clearTimeout(timer)
      this.alertTimers.delete(eventId)
    }

    // Escalate to next level if possible
    const nextLevel = this.getNextAlertLevel(event.alertLevel)
    if (nextLevel) {
      const nextConfig = this.getAlertConfiguration(nextLevel)
      if (nextConfig) {
        await this.notifyStaff(event, nextConfig)
      }
    }

    appLogger.info('Crisis event escalated', {
      eventId,
      handledBy,
      newLevel: nextLevel || event.alertLevel,
    })
  }

  async resolveEvent(
    eventId: string,
    handledBy: string,
    notes?: string,
  ): Promise<void> {
    const event = this.activeEvents.get(eventId)
    if (!event) {
      throw new Error(`Crisis event not found: ${eventId}`)
    }

    event.resolved = true
    event.handledBy = handledBy
    event.notes = notes

    // Clear any pending timers
    const timer = this.alertTimers.get(eventId)
    if (timer) {
      clearTimeout(timer)
      this.alertTimers.delete(eventId)
    }

    // Update database
    if (this.config) {
      await this.config.crisisEventRecorder({
        id: event.id,
        userId: event.userId,
        sessionId: event.sessionId,
        timestamp: event.timestamp,
        content: event.content,
        confidence: event.confidence,
        detectedRisks: event.detectedRisks,
        alertLevel: event.alertLevel,
        escalated: event.escalated,
        resolved: event.resolved,
        handledBy: event.handledBy,
        notes: event.notes,
      })
    }

    // Remove from active events
    this.activeEvents.delete(eventId)

    appLogger.info('Crisis event resolved', {
      eventId,
      handledBy,
      notes,
    })
  }

  getActiveEvents(): CrisisEvent[] {
    return Array.from(this.activeEvents.values())
  }

  getEvent(eventId: string): CrisisEvent | undefined {
    return this.activeEvents.get(eventId)
  }

  private determineAlertLevel(
    confidence: number,
    detectedRisks: string[],
  ): AlertConfiguration['level'] {
    if (!this.config) {
      return 'concern'
    }

    // Check for emergency keywords
    const emergencyTerms = [
      'immediate danger',
      'right now',
      'tonight',
      'suicide plan',
    ]
    if (
      detectedRisks.some((risk) =>
        emergencyTerms.some((term) => risk.includes(term)),
      )
    ) {
      return 'emergency'
    }

    // Check confidence thresholds
    if (confidence >= 0.9) {
      return 'emergency'
    }
    if (confidence >= 0.7) {
      return 'severe'
    }
    if (confidence >= 0.5) {
      return 'moderate'
    }
    return 'concern'
  }

  private getAlertConfiguration(
    level: AlertConfiguration['level'],
  ): AlertConfiguration | null {
    if (!this.config) {
      return null
    }
    return (
      this.config.alertConfigurations.find(
        (config) => config.level === level,
      ) || null
    )
  }

  private getNextAlertLevel(
    currentLevel: AlertConfiguration['level'],
  ): AlertConfiguration['level'] | null {
    const levels: AlertConfiguration['level'][] = [
      'concern',
      'moderate',
      'severe',
      'emergency',
    ]
    const currentIndex = levels.indexOf(currentLevel)
    return currentIndex < levels.length - 1 ? levels[currentIndex + 1] : null
  }

  private async notifyStaff(
    event: CrisisEvent,
    config: AlertConfiguration,
  ): Promise<void> {
    if (!this.config) {
      return
    }

    try {
      const channels = this.config.staffChannels[event.alertLevel] || []

      for (const channel of channels) {
        if (
          channel === 'SLACK_WEBHOOK_CHANNEL' &&
          this.config.slackWebhookUrl
        ) {
          await this.sendSlackNotification(event, config)
        }
        // Add other notification channels (email, SMS, etc.) here
      }
    } catch (error: unknown) {
      appLogger.error('Error sending staff notifications:', error)
    }
  }

  private async sendSlackNotification(
    event: CrisisEvent,
    config: AlertConfiguration,
  ): Promise<void> {
    if (!this.config?.slackWebhookUrl) {
      return
    }

    try {
      const message = this.formatSlackMessage(event, config)

      const response = await fetch(this.config.slackWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: `🚨 Crisis Alert - ${config.level.toUpperCase()}`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: message,
              },
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'Handle Crisis',
                  },
                  value: event.id,
                  style: 'primary',
                },
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'Escalate',
                  },
                  value: `escalate_${event.id}`,
                  style: 'danger',
                },
              ],
            },
          ],
        }),
      })

      if (!response.ok) {
        throw new Error(
          `Slack notification failed: ${response.status} ${response.statusText}`,
        )
      }

      appLogger.info('Slack notification sent', {
        eventId: event.id,
        alertLevel: event.alertLevel,
      })
    } catch (error: unknown) {
      appLogger.error('Failed to send Slack notification:', error)
    }
  }

  private formatSlackMessage(
    event: CrisisEvent,
    config: AlertConfiguration,
  ): string {
    return `
*Crisis Detection Alert*
*Level:* ${config.level.toUpperCase()}
*Confidence:* ${(event.confidence * 100).toFixed(1)}%
*User ID:* ${event.userId}
*Detected Risks:* ${event.detectedRisks.join(', ')}
*Time:* ${new Date(event.timestamp).toLocaleString()}

*Required Actions:*
${config.requiredActions.map((action) => `• ${action}`).join('\n')}

*Response Template:*
${config.responseTemplate.replace('{triggerTerms}', event.detectedRisks.join(', '))}
    `.trim()
  }

  private scheduleAutoEscalation(
    event: CrisisEvent,
    config: AlertConfiguration,
  ): void {
    const timer = setTimeout(async () => {
      try {
        if (
          this.activeEvents.has(event.id) &&
          !this.activeEvents.get(event.id)?.resolved
        ) {
          await this.escalateEvent(event.id, 'auto-escalation')
        }
      } catch (error: unknown) {
        appLogger.error('Auto-escalation failed:', error)
      }
    }, config.autoEscalateAfterMs)

    this.alertTimers.set(event.id, timer)
  }
}
