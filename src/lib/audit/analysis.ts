import type { AuditLog } from './types'

export type UnusualPatternSeverity = 'low' | 'medium' | 'high'
export type UnusualPatternType =
  | 'high_frequency'
  | 'odd_hours'
  | 'sensitive_access'

export interface UnusualPattern {
  type: UnusualPatternType
  severity: UnusualPatternSeverity
  description: string
  relatedLogs: AuditLog[]
}

interface AccessFrequency {
  userId: string
  count: number
  logs: AuditLog[]
}

const FREQUENCY_THRESHOLDS = {
  LOW: 20,
  MEDIUM: 35,
  HIGH: 50,
}

const SENSITIVE_RESOURCES = [
  'financial',
  'pii',
  'health_records',
  'credentials',
]

/**
 * Detects users with unusually high access frequency
 */
export function detectHighFrequency(
  logs: AuditLog[],
  timeWindowMinutes: number = 60,
): UnusualPattern[] {
  const patterns: UnusualPattern[] = []
  const now = new Date()
  const windowStart = new Date(now.getTime() - timeWindowMinutes * 60 * 1000)

  // Filter logs within time window and group by user
  const recentLogs = logs.filter(
    (log) => new Date(log.timestamp) >= windowStart,
  )
  const userFrequency = recentLogs.reduce<Record<string, AccessFrequency>>(
    (acc, log) => {
      if (!acc[log.userId]) {
        acc[log.userId] = { userId: log.userId, count: 0, logs: [] }
      }
      acc[log.userId].count++
      acc[log.userId].logs.push(log)
      return acc
    },
    {},
  )

  // Check each user's access frequency against thresholds
  Object.values(userFrequency).forEach(({ userId, count, logs }) => {
    let severity: UnusualPatternSeverity | null = null

    if (count >= FREQUENCY_THRESHOLDS.HIGH) {
      severity = 'high'
    } else if (count >= FREQUENCY_THRESHOLDS.MEDIUM) {
      severity = 'medium'
    } else if (count >= FREQUENCY_THRESHOLDS.LOW) {
      severity = 'low'
    }

    if (severity) {
      patterns.push({
        type: 'high_frequency',
        severity,
        description: `User ${userId} accessed system ${count} times in the last ${timeWindowMinutes} minutes`,
        relatedLogs: logs,
      })
    }
  })

  return patterns
}

/**
 * Detects access during unusual hours (11 PM - 5 AM)
 */
export function detectOddHours(logs: AuditLog[]): UnusualPattern[] {
  const patterns: UnusualPattern[] = []
  const oddHourLogs = logs.filter((log) => {
    const hour = new Date(log.timestamp).getHours()
    return hour >= 23 || hour <= 5
  })

  if (oddHourLogs.length === 0) {
    return patterns
  }

  // Group by user
  const userOddHours = oddHourLogs.reduce<Record<string, AuditLog[]>>(
    (acc, log) => {
      if (!acc[log.userId]) {
        acc[log.userId] = []
      }
      acc[log.userId].push(log)
      return acc
    },
    {},
  )

  // Create patterns for users with odd hour access (minimum threshold of 3)
  Object.entries(userOddHours).forEach(([userId, logs]) => {
    if (logs.length >= 3) {
      const severity: UnusualPatternSeverity =
        logs.length >= 10 ? 'high' : logs.length >= 5 ? 'medium' : 'low'

      patterns.push({
        type: 'odd_hours',
        severity,
        description: `User ${userId} accessed system ${logs.length} times during unusual hours (11 PM - 5 AM)`,
        relatedLogs: logs,
      })
    }
  })

  return patterns
}

/**
 * Detects excessive access to sensitive resources
 */
export function detectSensitiveAccess(logs: AuditLog[]): UnusualPattern[] {
  const patterns: UnusualPattern[] = []

  // Filter logs for sensitive resource access
  const sensitiveLogs = logs.filter((log) =>
    SENSITIVE_RESOURCES.includes(log.resourceType.toLowerCase()),
  )

  if (sensitiveLogs.length === 0) {
    return patterns
  }

  // Group by user
  const userSensitiveAccess = sensitiveLogs.reduce<Record<string, AuditLog[]>>(
    (acc, log) => {
      if (!acc[log.userId]) {
        acc[log.userId] = []
      }
      acc[log.userId].push(log)
      return acc
    },
    {},
  )

  // Create patterns for users with high sensitive resource access (minimum threshold of 10)
  Object.entries(userSensitiveAccess).forEach(([userId, logs]) => {
    if (logs.length >= 10) {
      const severity: UnusualPatternSeverity =
        logs.length >= 20 ? 'high' : logs.length >= 15 ? 'medium' : 'low'

      patterns.push({
        type: 'sensitive_access',
        severity,
        description: `User ${userId} accessed sensitive resources ${logs.length} times`,
        relatedLogs: logs,
      })
    }
  })

  return patterns
}

/**
 * Main function that combines all detection methods
 */
export function detectUnusualPatterns(logs: AuditLog[]): UnusualPattern[] {
  return [
    ...detectHighFrequency(logs),
    ...detectOddHours(logs),
    ...detectSensitiveAccess(logs),
  ]
}
