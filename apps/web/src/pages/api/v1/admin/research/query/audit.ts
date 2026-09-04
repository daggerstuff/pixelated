import type { APIRoute } from 'astro'

import { protectRoute } from '../../../../../../lib/auth/serverAuth'
import { getQueryAuditService } from '../../../../../../lib/research/services/QueryAuditService'

export const prerender = false

export const GET = protectRoute(
  { requiredRole: 'admin', validateIPMatch: true, validateUserAgent: true },
  async ({ request }) => {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId') ?? undefined
    const queryId = url.searchParams.get('queryId') ?? undefined
    const queryType = url.searchParams.get('queryType') ?? undefined
    const startDate = url.searchParams.get('startDate') ?? undefined
    const endDate = url.searchParams.get('endDate') ?? undefined
    const stats = url.searchParams.get('stats') === 'true'

    const auditService = getQueryAuditService()

    if (stats) {
      const auditStats = auditService.getAuditStats()
      return new Response(JSON.stringify(auditStats), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      })
    }

    const trail = auditService.getAuditTrail({
      userId,
      queryId,
      queryType: queryType as string,
      startDate,
      endDate,
    })

    return new Response(
      JSON.stringify({ entries: trail, count: trail.length }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      },
    )
  },
)
