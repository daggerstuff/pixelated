import { verifyAdmin } from '@/lib/admin/middleware'
import type { BaseAPIContext } from '@/lib/auth/apiRouteTypes'
import { stateConsentRulesCache } from '@/lib/ehr-native/consent/state-rules/cache'
import {
  stateConsentRulesRepository,
  mapAdminRoleToEhrRole,
  type ActorContext,
} from '@/lib/ehr-native/consent/state-rules/repository'

export const prerender = false

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
}

/**
 * POST /api/v1/admin/state-consent-rules/{ruleId}/activate
 * Activate an approved rule. Supersedes any previously active rule
 * for the same state_code + tenant.
 * Body: { notes? }
 */
export const POST = async ({ request, cookies, params }: BaseAPIContext) => {
  const admin = await verifyAdmin({ request, cookies } as BaseAPIContext)
  if (!admin) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: JSON_HEADERS,
    })
  }

  try {
    const ruleId = params.ruleId
    if (!ruleId) {
      return new Response(JSON.stringify({ error: 'ruleId is required' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }

    let notes: string | undefined
    try {
      const body = await request.json()
      notes = body.notes
    } catch {
      // No body or invalid JSON — notes is optional
    }

    const actor: ActorContext = {
      userId: admin.userId,
      role: mapAdminRoleToEhrRole(admin.role),
    }

    const rule = await stateConsentRulesRepository.activate(
      ruleId,
      actor,
      notes,
    )
    if (!rule) {
      return new Response(
        JSON.stringify({ error: 'Rule not found or not in approved status' }),
        {
          status: 404,
          headers: JSON_HEADERS,
        },
      )
    }

    await stateConsentRulesCache.invalidate(rule.stateCode, rule.tenantId)

    return new Response(JSON.stringify({ rule }), {
      status: 200,
      headers: JSON_HEADERS,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: 'Failed to activate rule', detail: message }),
      {
        status: 500,
        headers: JSON_HEADERS,
      },
    )
  }
}
