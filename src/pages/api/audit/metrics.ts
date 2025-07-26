import type { APIRoute } from 'astro'
import { getAuditLogs } from '../../../lib/audit/log'
import { detectUnusualPatterns } from '../../../lib/audit/analysis'

export const GET: APIRoute = async () => {
  try {
    // Get all audit logs and filter by date in memory
    // since getAuditLogs doesn't support date filtering directly
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const allLogs = await getAuditLogs()
    const logs = allLogs.filter(
      (log) => log.timestamp >= yesterday && log.timestamp <= now,
    )

    // Process logs into time-based metrics (hourly intervals)
    const hourlyAccess = new Array(24).fill(0)
    const accessTypes = new Map<string, number>()

    logs.forEach((log) => {
      // Increment hourly access count
      const hour = new Date(log.timestamp).getHours()
      hourlyAccess[hour]++

      // Count access types using the action property
      const type = log.action
      accessTypes.set(type, (accessTypes.get(type) || 0) + 1)
    })

    // Generate labels for the last 24 hours
    const timeLabels = Array.from({ length: 24 }, (_, i) => {
      const hour = (now.getHours() - (23 - i) + 24) % 24
      return `${hour}:00`
    })

    // Convert access types map to arrays for the pie chart
    const accessTypeEntries = Array.from(accessTypes.entries())
    const accessTypeLabels = accessTypeEntries.map(([type]) => type)
    const accessTypeData = accessTypeEntries.map(([, count]) => count)

    // Transform logs to match AuditLog interface
    const transformedLogs = logs.map((log) => ({
      id: log.id,
      timestamp: log.timestamp.toISOString(),
      userId: log.userId,
      resourceId: log.resource.id,
      resourceType: log.resource.type,
      action: log.action as 'view' | 'create' | 'update' | 'delete',
      metadata: log.metadata,
    }))

    // Detect unusual access patterns
    const unusualPatterns = await detectUnusualPatterns(transformedLogs)

    return new Response(
      JSON.stringify({
        accessByTime: {
          labels: timeLabels,
          data: hourlyAccess,
        },
        accessByType: {
          labels: accessTypeLabels,
          data: accessTypeData,
        },
        unusualAccess: {
          count: unusualPatterns.length,
          details: unusualPatterns.map((p) => p.description),
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error) {
    console.error('Error processing audit metrics:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to process audit metrics',
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
