import type { APIRoute } from 'astro'
// Define audit log types
interface AuditLog {
  id: string
  timestamp: Date
  action: string
  userId?: string
  resource?: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

interface UnusualPattern {
  type:
    | 'high_frequency'
    | 'unusual_time'
    | 'failed_attempts'
    | 'suspicious_access'
  description: string
  severity: 'low' | 'medium' | 'high'
  count: number
  timeframe: string
}

// Mock audit logs function (replace with actual database call)
async function getAuditLogs(): Promise<AuditLog[]> {
  // In a real implementation, this would fetch from your database
  // For now, returning mock data to demonstrate the structure
  return [
    {
      id: '1',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      action: 'login',
      userId: 'user1',
      resource: '/auth/login',
      ipAddress: '192.168.1.1',
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      action: 'page_view',
      userId: 'user1',
      resource: '/dashboard',
      ipAddress: '192.168.1.1',
    },
    // Add more mock data as needed
  ]
}

// Detect unusual patterns in audit logs
function detectUnusualPatterns(logs: AuditLog[]): UnusualPattern[] {
  const patterns: UnusualPattern[] = []

  // High frequency access detection
  const actionCounts = new Map<string, number>()
  logs.forEach((log: AuditLog) => {
    actionCounts.set(log.action, (actionCounts.get(log.action) || 0) + 1)
  })

  actionCounts.forEach((count, action) => {
    if (count > 10) {
      // Threshold for high frequency
      patterns.push({
        type: 'high_frequency',
        description: `High frequency ${action} actions detected`,
        severity: count > 20 ? 'high' : 'medium',
        count,
        timeframe: '24 hours',
      })
    }
  })

  // Failed login attempts
  const failedLogins = logs.filter(
    (log: AuditLog) =>
      log.action === 'login_failed' || log.action === 'authentication_failed',
  )

  if (failedLogins.length > 5) {
    patterns.push({
      type: 'failed_attempts',
      description: 'Multiple failed login attempts detected',
      severity: failedLogins.length > 10 ? 'high' : 'medium',
      count: failedLogins.length,
      timeframe: '24 hours',
    })
  }

  return patterns
}

export const GET: APIRoute = async () => {
  try {
    // Get all audit logs and filter by date in memory
    // since getAuditLogs doesn't support date filtering directly
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const allLogs = await getAuditLogs()
    const logs = allLogs.filter(
      (log: AuditLog) => log.timestamp >= yesterday && log.timestamp <= now,
    )

    // Process logs into time-based metrics (hourly intervals)
    const hourlyAccess = Array.from({ length: 24 }, () => 0)
    const accessTypes = new Map<string, number>()

    logs.forEach((log: AuditLog) => {
      // Increment hourly access count
      const hour = new Date(log.timestamp).getHours()
      hourlyAccess[hour]++

      // Count access types using the action property
      const type = log.action
      accessTypes.set(type, (accessTypes.get(type) || 0) + 1)
    })

    // Detect unusual patterns
    const unusualPatterns = detectUnusualPatterns(logs)

    // Convert access types map to object for JSON serialization
    const accessTypesObject = Object.fromEntries(accessTypes)

    // Transform logs for client consumption (remove sensitive data)
    const transformedLogs = logs.map((log: AuditLog) => ({
      id: log.id,
      timestamp: log.timestamp,
      action: log.action,
      resource: log.resource,
      // Exclude sensitive fields like userId, ipAddress for security
    }))

    // Return metrics summary
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          timeRange: {
            start: yesterday.toISOString(),
            end: now.toISOString(),
          },
          summary: {
            totalEvents: logs.length,
            uniqueActions: accessTypes.size,
            unusualPatternsCount: unusualPatterns.length,
          },
          metrics: {
            hourlyAccess,
            accessTypes: accessTypesObject,
            unusualPatterns,
          },
          recentLogs: transformedLogs.slice(-10), // Last 10 logs
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      },
    )
  } catch (error: unknown) {
    console.error('Error generating audit metrics:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to generate audit metrics',
        message: error instanceof Error ? String(error) : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}
