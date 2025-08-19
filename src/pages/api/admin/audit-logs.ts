import { type AuditLogEntry, getUserAuditLogs } from '../../../lib/audit/log'
import { createBuildSafeLogger } from '../../../lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('admin-audit-logs')

export const GET = async ({ url }) => {
  try {
    const { searchParams } = new URL(url)

    const eventType = searchParams.get('eventType')
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    let logs: AuditLogEntry[] = []

    if (userId) {
      logs = await getUserAuditLogs(userId, limit, offset)
    } else {
      // TODO: Implement getActionAuditLogs and getAuditLogs functions
      // For now, return empty array to prevent build errors
      logger.info('Audit logs requested', { eventType, limit, offset })
      logs = []
    }

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
