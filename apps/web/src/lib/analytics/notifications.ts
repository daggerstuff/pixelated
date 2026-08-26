/**
 * Notification Effectiveness Analytics Module
 *
 * Evaluates the effectiveness of security breach notifications based on multiple factors:
 * - Delivery success rates
 * - Timing and speed of notification
 * - Recipient acknowledgment rates
 * - Compliance with regulatory timeframes
 * - Action taken rates
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('notification-analytics')

// Constants for scoring weights and thresholds
const WEIGHTS = {
  DELIVERY: 0.3,
  TIMING: 0.25,
  ACKNOWLEDGMENT: 0.25,
  COMPLIANCE: 0.2,
} as const

const THRESHOLDS = {
  CRITICAL_DELIVERY: 0.98, // 98% delivery required for critical breaches
  STANDARD_DELIVERY: 0.95, // 95% delivery required for standard breaches
  ACKNOWLEDGMENT: 0.85, // 85% acknowledgment target
  NOTIFICATION_HOURS: 72, // 72 hour notification window
  CRITICAL_HOURS: 24, // 24 hour window for critical breaches
} as const

// Regulatory compliance timeframes in hours
const COMPLIANCE_TIMEFRAMES = {
  HIPAA: 60, // 60 days
  GDPR: 72, // 72 hours
  CCPA: 720, // 30 days
  PCI: 24, // 24 hours
} as const

export interface BreachSeverity {
  level: 'critical' | 'high' | 'medium' | 'low'
  score: number
}

export interface NotificationMetrics {
  total: number
  delivered: number
  failed: number
  acknowledged: number
  actioned: number
  timeToNotify: number // hours
  timeToAcknowledge: number // hours
}

export interface Breach {
  id: string
  timestamp: Date
  severity: BreachSeverity
  notificationStatus: 'pending' | 'in-progress' | 'completed' | 'failed'
  notifications?: NotificationMetrics
  regulatoryFrameworks: Array<keyof typeof COMPLIANCE_TIMEFRAMES>
}

export interface EffectivenessMetrics {
  overall: number
  delivery: number
  timing: number
  acknowledgment: number
  compliance: number
  details: {
    totalBreaches: number
    criticalBreaches: number
    averageTimeToNotify: number
    averageTimeToAcknowledge: number
    deliveryRate: number
    acknowledgmentRate: number
    complianceRate: number
  }
}

/**
 * Calculates delivery effectiveness based on notification success rates
 */
function calculateDeliveryScore(breach: Breach): number {
  if (!breach.notifications) {
    logger.warn(`No notification data available for breach ${breach.id}`)
    return 0
  }

  const { total, delivered } = breach.notifications
  if (total === 0) {
    return 0
  }

  const deliveryRate = delivered / total
  const requiredRate =
    breach.severity.level === 'critical'
      ? THRESHOLDS.CRITICAL_DELIVERY
      : THRESHOLDS.STANDARD_DELIVERY

  return Math.min(1, deliveryRate / requiredRate)
}

/**
 * Calculates timing effectiveness based on notification speed
 */
function calculateTimingScore(breach: Breach): number {
  if (!breach.notifications?.timeToNotify) {
    return 0
  }

  const maxTime =
    breach.severity.level === 'critical'
      ? THRESHOLDS.CRITICAL_HOURS
      : THRESHOLDS.NOTIFICATION_HOURS

  const timingRatio = maxTime / breach.notifications.timeToNotify
  return Math.min(1, timingRatio)
}

/**
 * Calculates acknowledgment effectiveness
 */
function calculateAcknowledgmentScore(breach: Breach): number {
  if (!breach.notifications) {
    return 0
  }

  const { delivered, acknowledged } = breach.notifications
  if (delivered === 0) {
    return 0
  }

  const ackRate = acknowledged / delivered
  return Math.min(1, ackRate / THRESHOLDS.ACKNOWLEDGMENT)
}

/**
 * Calculates regulatory compliance score
 */
function calculateComplianceScore(breach: Breach): number {
  if (
    !breach.notifications?.timeToNotify ||
    !breach.regulatoryFrameworks.length
  ) {
    return 0
  }

  const scores = breach.regulatoryFrameworks.map((framework) => {
    const timeframe = COMPLIANCE_TIMEFRAMES[framework]
    return breach.notifications!.timeToNotify <= timeframe ? 1 : 0
  })

  return scores.reduce<number>((sum, score) => sum + score, 0) / scores.length
}

/**
 * Returns empty metrics structure for when no breaches are provided
 */
function getEmptyMetrics(): EffectivenessMetrics {
  return {
    overall: 0,
    delivery: 0,
    timing: 0,
    acknowledgment: 0,
    compliance: 0,
    details: {
      totalBreaches: 0,
      criticalBreaches: 0,
      averageTimeToNotify: 0,
      averageTimeToAcknowledge: 0,
      deliveryRate: 0,
      acknowledgmentRate: 0,
      complianceRate: 0,
    },
  }
}

/**
 * Calculates the overall notification effectiveness for a set of breaches
 *
 * @param breaches Array of breach objects to analyze
 * @returns Detailed effectiveness metrics
 * @throws Error if breaches array is invalid
 */
export async function calculate(
  breaches: Breach[],
): Promise<EffectivenessMetrics> {
  if (!Array.isArray(breaches)) {
    throw new Error('Invalid breaches array provided')
  }

  if (!breaches.length) {
    logger.warn('No breaches provided for analysis')
    return getEmptyMetrics()
  }

  try {
    let totalDeliveryScore = 0
    let totalTimingScore = 0
    let totalAckScore = 0
    let totalComplianceScore = 0

    const details = {
      totalBreaches: breaches.length,
      criticalBreaches: 0,
      averageTimeToNotify: 0,
      averageTimeToAcknowledge: 0,
      deliveryRate: 0,
      acknowledgmentRate: 0,
      complianceRate: 0,
    }

    // Calculate individual scores and collect statistics
    for (const breach of breaches) {
      if (breach.severity.level === 'critical') {
        details.criticalBreaches++
      }

      if (breach.notifications) {
        const {
          timeToNotify,
          timeToAcknowledge,
          delivered,
          total,
          acknowledged,
        } = breach.notifications

        details.averageTimeToNotify += timeToNotify || 0
        details.averageTimeToAcknowledge += timeToAcknowledge || 0
        details.deliveryRate += total ? delivered / total : 0
        details.acknowledgmentRate += delivered ? acknowledged / delivered : 0
      }

      totalDeliveryScore += calculateDeliveryScore(breach)
      totalTimingScore += calculateTimingScore(breach)
      totalAckScore += calculateAcknowledgmentScore(breach)
      totalComplianceScore += calculateComplianceScore(breach)
    }

    // Calculate final scores
    const delivery = totalDeliveryScore / breaches.length
    const timing = totalTimingScore / breaches.length
    const acknowledgment = totalAckScore / breaches.length
    const compliance = totalComplianceScore / breaches.length

    // Calculate weighted overall score
    const overall =
      delivery * WEIGHTS.DELIVERY +
      timing * WEIGHTS.TIMING +
      acknowledgment * WEIGHTS.ACKNOWLEDGMENT +
      compliance * WEIGHTS.COMPLIANCE

    // Finalize averages in details
    details.averageTimeToNotify /= breaches.length
    details.averageTimeToAcknowledge /= breaches.length
    details.deliveryRate /= breaches.length
    details.acknowledgmentRate /= breaches.length
    details.complianceRate = compliance

    return {
      overall: Math.max(0, Math.min(1, overall)),
      delivery,
      timing,
      acknowledgment,
      compliance,
      details,
    }
  } catch (error: unknown) {
    logger.error('Error calculating notification effectiveness:', {
      error: (error as Error).message,
    })
    throw new Error('Failed to calculate notification effectiveness', {
      cause: error,
    })
  }
}

/**
 * Calculates the daily notification effectiveness metrics
 *
 * @param breaches Array of breach objects from the specific day
 * @returns Daily effectiveness metrics
 */
export async function calculateDaily(
  breaches: Breach[],
): Promise<EffectivenessMetrics> {
  // Filter breaches to ensure they're from the same day
  const today = new Date()
  const dailyBreaches = breaches.filter((breach) => {
    const breachDate = new Date(breach.timestamp)
    return (
      breachDate.getFullYear() === today.getFullYear() &&
      breachDate.getMonth() === today.getMonth() &&
      breachDate.getDate() === today.getDate()
    )
  })

  return calculate(dailyBreaches)
}
