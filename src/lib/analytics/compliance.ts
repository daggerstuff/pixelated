/**
 * Compliance Metrics Module
 *
 * Provides metrics calculation for regulatory compliance related to security breaches.
 */

/**
 * Interface representing a security breach
 */
export interface ComplianceBreach {
  id: string
  severity: string
  timestamp: number
  notificationStatus?: string
  notificationDelay?: number
  documentationComplete?: boolean
  type: string
  affectedUsers: string[]
}

/**
 * Calculates a compliance score based on breach details
 *
 * @param breaches Array of breach objects to analyze
 * @returns A compliance score between 0 and 1
 */
export async function calculateScore(
  breaches: ComplianceBreach[],
): Promise<number> {
  // Mock implementation
  if (!breaches.length) {
    return 1.0
  }

  // Base compliance score
  let baseScore = 0.98

  // Reduce score for critical breaches
  const criticalBreaches = breaches.filter(
    (breach) => breach.severity === 'critical',
  ).length
  baseScore -= criticalBreaches * 0.02

  // Reduce score for delayed notifications
  const delayedNotifications = breaches.filter(
    (breach) =>
      breach.notificationStatus !== 'completed' ||
      (breach.notificationDelay &&
        breach.notificationDelay > 24 * 60 * 60 * 1000), // 24 hours
  ).length
  baseScore -= delayedNotifications * 0.01

  // Reduce score for breaches without proper documentation
  const undocumentedBreaches = breaches.filter(
    (breach) => !breach.documentationComplete,
  ).length
  baseScore -= undocumentedBreaches * 0.01

  // Ensure score is between 0 and 1
  return Math.max(0, Math.min(1, baseScore))
}
