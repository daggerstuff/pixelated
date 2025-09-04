/**
 * Risk Alert System
 *
 * Provides alerting capabilities for critical risk levels detected in the system.
 * This service manages notifications, escalations, and human oversight for high-risk situations.
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'
import type { RiskLevel, RiskAssessmentResult } from './risk-level-assessment'
import { AIRepository } from '../db/ai/repository'

const logger = createBuildSafeLogger('risk-alert-system')

/**
 * Alert notification channels
 */
export type AlertChannel = 'email' | 'dashboard' | 'sms' | 'webhook'

/**
 * Alert configuration
 */
export interface AlertConfig {
  enabledChannels: AlertChannel[]
  thresholds: {
    [key in RiskLevel]?: {
      notify: boolean
      requireHumanReview: boolean
      escalate: boolean
    }
  }
  recipients?: {
    email?: string[]
    sms?: string[]
    webhook?: string[]
  }
  cooldownPeriod?: number // in milliseconds
}

/**
 * Alert details
 */
export interface AlertDetails {
  id: string
  userId: string
  level: RiskLevel
  source: string
  timestamp: number
  factors: string[]
  score: number
  description: string
  requiresHumanReview: boolean
  status: 'pending' | 'reviewed' | 'resolved' | 'false-positive'
  reviewedBy?: string
  reviewNotes?: string
  metadata?: Record<string, unknown>
}

/**
 * Default alert configuration
 */
const DEFAULT_CONFIG: AlertConfig = {
  enabledChannels: ['dashboard'],
  thresholds: {
    low: {
      notify: false,
      requireHumanReview: false,
      escalate: false,
    },
    medium: {
      notify: true,
      requireHumanReview: false,
      escalate: false,
    },
    high: {
      notify: true,
      requireHumanReview: true,
      escalate: false,
    },
    critical: {
      notify: true,
      requireHumanReview: true,
      escalate: true,
    },
  },
  cooldownPeriod: 1800000, // 30 minutes
}

/**
 * Risk Alert System
 *
 * This service manages notifications and human oversight for risk alerts.
 */
export class RiskAlertSystem {
  private static instance: RiskAlertSystem
  private config: AlertConfig
  private lastAlerts: Map<string, number> = new Map()
  private repository: AIRepository

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor(config: Partial<AlertConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.repository = new AIRepository()
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(config?: Partial<AlertConfig>): RiskAlertSystem {
    if (!RiskAlertSystem.instance) {
      RiskAlertSystem.instance = new RiskAlertSystem(config)
    }
    return RiskAlertSystem.instance
  }

  /**
   * Configure the alert system
   */
  public configure(config: Partial<AlertConfig>) {
    this.config = { ...this.config, ...config }
    logger.info('Risk alert system configured', {
      enabledChannels: this.config.enabledChannels,
      thresholds: this.config.thresholds,
    })
  }

  /**
   * Process risk assessment result and trigger alerts if necessary
   *
   * @param assessment Risk assessment result
   * @param userId The user ID associated with the assessment
   * @param source The source of the assessment (e.g., 'chat', 'forum', 'notes')
   * @param metadata Additional metadata for the alert
   * @returns True if an alert was triggered, false otherwise
   */
  public async processAssessment(
    assessment: RiskAssessmentResult,
    userId: string,
    source: string,
    metadata: Record<string, unknown> = {},
  ): Promise<boolean> {
    const { level, factors, score } = assessment

    // Check if we should alert based on thresholds
    const threshold = this.config.thresholds[level]
    if (!threshold || !threshold.notify) {
      return false
    }

    // Check cooldown period
    const userKey = `${userId}:${level}`
    const lastAlertTime = this.lastAlerts.get(userKey) || 0
    const now = Date.now()

    if (now - lastAlertTime < (this.config.cooldownPeriod || 0)) {
      logger.info('Alert suppressed due to cooldown period', {
        userId,
        level,
        lastAlertTime,
      })
      return false
    }

    // Create alert details
    const alertId = crypto.randomUUID()
    const alertDetails: AlertDetails = {
      id: alertId,
      userId,
      level,
      source,
      timestamp: now,
      factors: factors.map((f) => f.type),
      score,
      description: `Risk level ${level} detected from ${source}`,
      requiresHumanReview: threshold.requireHumanReview,
      status: 'pending',
      metadata,
    }

    // Send alerts through enabled channels
    await this.sendAlerts(alertDetails)

    // Store alert in repository if it's high or critical
    if (level === 'high' || level === 'critical') {
      await this.storeAlert(alertDetails)
    }

    // Update cooldown timestamp
    this.lastAlerts.set(userKey, now)

    // Log the alert
    logger.info('Risk alert triggered', {
      alertId,
      userId,
      level,
      source,
      factors: alertDetails.factors,
    })

    return true
  }

  /**
   * Send alerts through configured channels
   */
  private async sendAlerts(alert: AlertDetails) {
    const { enabledChannels } = this.config

    // Process each enabled channel
    for (const channel of enabledChannels) {
      try {
        switch (channel) {
          case 'dashboard':
            await this.sendDashboardAlert(alert)
            break
          case 'email':
            await this.sendEmailAlert(alert)
            break
          case 'sms':
            await this.sendSmsAlert(alert)
            break
          case 'webhook':
            await this.sendWebhookAlert(alert)
            break
        }
      } catch (error: unknown) {
        logger.error(`Failed to send alert via ${channel}`, {
          error: error instanceof Error ? String(error) : String(error),
          alertId: alert.id,
          userId: alert.userId,
          level: alert.level,
        })
      }
    }
  }

  /**
   * Store alert in repository for high and critical risks
   */
  private async storeAlert(alert: AlertDetails) {
    try {
      if (!alert.userId) {
        logger.warn('Cannot store alert without user ID', {
          alertId: alert.id,
          level: alert.level,
        })
        return
      }

      // Store in Supabase using the AI repository
      await this.repository.storeCrisisDetection({
        userId: alert.userId,
        modelId: 'risk-assessment-system',
        modelProvider: 'internal',
        requestTokens: 0,
        responseTokens: 0,
        totalTokens: 0,
        latencyMs: 0,
        success: true,
        error: null,
        text: alert.description,
        crisisDetected: alert.level === 'high' || alert.level === 'critical',
        crisisType: alert.factors.join(', '),
        confidence: alert.score,
        riskLevel: alert.level,
        sensitivityLevel: 1,
        metadata: {
          alertId: alert.id,
          source: alert.source,
          requiresHumanReview: alert.requiresHumanReview,
          ...alert.metadata,
        },
      })

      logger.info('Alert stored in repository', {
        alertId: alert.id,
        level: alert.level,
        userId: alert.userId,
      })
    } catch (error: unknown) {
      logger.error('Failed to store alert', {
        error: error instanceof Error ? String(error) : String(error),
        alertId: alert.id,
        userId: alert.userId,
        level: alert.level,
      })
    }
  }

  /**
   * Send dashboard alert
   */
  private async sendDashboardAlert(alert: AlertDetails) {
    // In a real implementation, this would add the alert to a real-time notification system
    // For now, we'll just log it
    logger.info('Dashboard alert sent', {
      alertId: alert.id,
      userId: alert.userId,
      level: alert.level,
    })
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(alert: AlertDetails) {
    const recipients = this.config.recipients?.email || []
    if (recipients.length === 0) {
      logger.warn('No email recipients configured for alerts')
      return
    }

    // In a real implementation, this would send an actual email
    // For now, we'll just log it
    logger.info('Email alert would be sent', {
      alertId: alert.id,
      recipients,
      level: alert.level,
      userId: alert.userId,
    })
  }

  /**
   * Send SMS alert
   */
  private async sendSmsAlert(alert: AlertDetails) {
    const recipients = this.config.recipients?.sms || []
    if (recipients.length === 0) {
      logger.warn('No SMS recipients configured for alerts')
      return
    }

    // In a real implementation, this would send an actual SMS
    // For now, we'll just log it
    logger.info('SMS alert would be sent', {
      alertId: alert.id,
      recipients,
      level: alert.level,
      userId: alert.userId,
    })
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(alert: AlertDetails) {
    const endpoints = this.config.recipients?.webhook || []
    if (endpoints.length === 0) {
      logger.warn('No webhook endpoints configured for alerts')
      return
    }

    // In a real implementation, this would send POST requests to webhook endpoints
    // For now, we'll just log it
    logger.info('Webhook alert would be sent', {
      alertId: alert.id,
      endpoints,
      level: alert.level,
      userId: alert.userId,
    })
  }

  /**
   * Get pending alerts that require human review
   */
  public async getPendingAlertsForReview(limit = 20): Promise<AlertDetails[]> {
    try {
      // Use the repository to get high-risk detections
      const results = await this.repository.getHighRiskCrisisDetections(limit)

      // Convert to AlertDetails format
      return results.map((result) => {
        const metadataObject =
          typeof result.metadata === 'object' && result.metadata !== null
            ? (result.metadata as Record<string, unknown>)
            : undefined

        return {
          id: result.id,
          userId: result.userId,
          level: result.riskLevel,
          source: (metadataObject?.['source'] as string) || 'unknown',
          timestamp: result.createdAt.getTime(),
          factors: result.crisisType ? result.crisisType.split(', ') : [],
          score: result.confidence,
          description: result.text,
          requiresHumanReview:
            (metadataObject?.['requiresHumanReview'] as boolean) ?? true,
          status:
            (metadataObject?.['status'] as AlertDetails['status']) || 'pending',
          reviewedBy: metadataObject?.['reviewedBy'] as string | undefined,
          reviewNotes: metadataObject?.['reviewNotes'] as string | undefined,
          metadata: metadataObject,
        }
      })
    } catch (error: unknown) {
      logger.error('Failed to get pending alerts', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return []
    }
  }
}

// Export singleton instance
export const riskAlertSystem = RiskAlertSystem.getInstance()
