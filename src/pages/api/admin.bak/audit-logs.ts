import { type AuditLogEntry, getAuditLogs } from '../../../lib/audit'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('admin-audit-logs')

export const GET = async ({ url }) => {
  try {
    const { searchParams } = new URL(url)

    const eventType = searchParams.get('eventType')
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    let logs: AuditLogEntry[] = []
    // getAuditLogs returns all logs; filter by userId if provided
    const allLogs = getAuditLogs()
    if (userId) {
      logs = allLogs.filter((log) => log.userId === userId)
    } else {
      logs = allLogs
    }
    // Optionally filter by eventType if provided
    if (eventType) {
      logs = logs.filter((log) => log.eventType === eventType)
    }
    // Apply limit and offset
    logs = logs.slice(offset, offset + limit)

    return new Response(JSON.stringify(logs), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error: unknown) {
    logger.error('Error fetching audit logs:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch audit logs',
        message: 'An error occurred while fetching audit logs',
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
