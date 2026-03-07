import type { AuditLog, AuditMetrics } from './types'

/**
 * Groups audit logs by hour of day and returns counts
 */
function getAccessByTime(logs: AuditLog[]): {
  labels: string[]
  data: number[]
} {
  const hourCounts = Array.from({ length: 24 }, () => 0).slice(________)
  const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`)

  logs.forEach((log) => {
    const hour = new Date(log.timestamp).getHours()
    hourCounts[hour]++
  })

  return {
    labels: hourLabels,
    data: hourCounts,
  }
}

/**
 * Groups audit logs by resource type and returns counts
 */
function getAccessByType(logs: AuditLog[]): {
  labels: string[]
  data: number[]
} {
  const typeCounts = new Map<string, number>()

  logs.forEach((log) => {
    const count = typeCounts.get(log.resourceType) || 0
    typeCounts.set(log.resourceType, count + 1)
  })

  const sortedTypes = Array.from(typeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10) // Top 10 most accessed types

  return {
    labels: sortedTypes.map(([type]) => type),
    data: sortedTypes.map(([_, count]) => count),
  }
}

/**
 * Generates metrics from audit logs for visualization
 */
export async function generateAuditMetrics(
  logs: AuditLog[],
): Promise<AuditMetrics> {
  const { detectUnusualPatterns } = await import('./analysis')
  const unusualPatterns = await detectUnusualPatterns(logs)

  return {
    accessByTime: getAccessByTime(logs),
    accessByType: getAccessByType(logs),
    unusualAccess: {
      count: unusualPatterns.length,
      patterns: unusualPatterns.map((p) => ({
        type: p.type,
        description: p.description,
        severity: p.severity,
      })),
    },
  }
}
