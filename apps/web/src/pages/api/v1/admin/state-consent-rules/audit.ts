import { verifyAdmin } from '@/lib/admin/middleware'
import type { BaseAPIContext } from '@/lib/auth/apiRouteTypes'
import { stateConsentRulesRepository } from '@/lib/ehr-native/consent/state-rules/repository'

export const prerender = false

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
}

/**
 * GET /api/v1/admin/state-consent-rules/audit
 * Get audit log entries for state consent rules.
 * Query: stateCode (required), limit
 */
export const GET = async ({ request, cookies }: BaseAPIContext) => {
  const admin = await verifyAdmin({ request, cookies } as BaseAPIContext)
  if (!admin) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: JSON_HEADERS,
    })
  }

  try {
    const searchParams = new URL(request.url).searchParams
    const stateCode = searchParams.get('stateCode')

    if (!stateCode) {
      return new Response(
        JSON.stringify({ error: 'stateCode query parameter is required' }),
        {
          status: 400,
          headers: JSON_HEADERS,
        },
      )
    }

    const limit = Math.min(
      200,
      Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)),
    )

    const entries = await stateConsentRulesRepository.getAuditLogByState(
      stateCode.toUpperCase(),
      limit,
    )

    return new Response(
      JSON.stringify({
        auditLog: entries,
        total: entries.length,
      }),
      {
        status: 200,
        headers: JSON_HEADERS,
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: 'Failed to fetch audit log', detail: message }),
      {
        status: 500,
        headers: JSON_HEADERS,
      },
    )
  }
}
