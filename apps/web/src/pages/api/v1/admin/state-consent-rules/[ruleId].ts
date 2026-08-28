import type { BaseAPIContext } from '@/lib/auth/apiRouteTypes'
import { verifyAdmin } from '@/lib/admin/middleware'
import {
  stateConsentRulesRepository,
  mapAdminRoleToEhrRole,
  type ActorContext,
} from '@/lib/ehr-native/consent/state-rules/repository'
import {
  safeValidateStateRuleConfig,
  type UpdateStateRuleInput,
} from '@/lib/ehr-native/consent/state-rules/schemas'

export const prerender = false

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
}

function buildActor(admin: { userId: string; role: string }): ActorContext {
  return {
    userId: admin.userId,
    role: mapAdminRoleToEhrRole(admin.role),
  }
}

/**
 * GET /api/v1/admin/state-consent-rules/{ruleId}
 * Get a single rule with its audit log.
 */
export const GET = async ({ request, cookies, params }: BaseAPIContext) => {
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

    const rule = await stateConsentRulesRepository.getById(ruleId)
    if (!rule) {
      return new Response(JSON.stringify({ error: 'Rule not found' }), {
        status: 404,
        headers: JSON_HEADERS,
      })
    }

    const auditLog = await stateConsentRulesRepository.getAuditLog(ruleId)

    return new Response(JSON.stringify({ rule, auditLog }), {
      status: 200,
      headers: JSON_HEADERS,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: 'Failed to fetch rule', detail: message }),
      {
        status: 500,
        headers: JSON_HEADERS,
      },
    )
  }
}

/**
 * PATCH /api/v1/admin/state-consent-rules/{ruleId}
 * Update a draft rule's configuration. Only works if status='draft'.
 * Body: { ruleConfig?, notes?, effectiveDate?, expiryDate? }
 */
export const PATCH = async ({ request, cookies, params }: BaseAPIContext) => {
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

    const body = await request.json()

    const updates: UpdateStateRuleInput = {}

    if (body.ruleConfig !== undefined) {
      const configResult = safeValidateStateRuleConfig(body.ruleConfig)
      if (!configResult.success) {
        return new Response(
          JSON.stringify({
            error: 'Invalid rule config',
            details: configResult.error.issues,
          }),
          {
            status: 400,
            headers: JSON_HEADERS,
          },
        )
      }
      updates.ruleConfig = configResult.data
    }

    if (body.notes !== undefined) {
      updates.notes = body.notes
    }
    if (body.effectiveDate !== undefined) {
      updates.effectiveDate = body.effectiveDate
    }
    if (body.expiryDate !== undefined) {
      updates.expiryDate = body.expiryDate
    }

    const actor = buildActor(admin)

    const rule = await stateConsentRulesRepository.updateDraft(
      ruleId,
      updates,
      actor,
    )
    if (!rule) {
      return new Response(
        JSON.stringify({ error: 'Rule not found or not in draft status' }),
        {
          status: 404,
          headers: JSON_HEADERS,
        },
      )
    }

    return new Response(JSON.stringify({ rule }), {
      status: 200,
      headers: JSON_HEADERS,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: 'Failed to update rule', detail: message }),
      {
        status: 500,
        headers: JSON_HEADERS,
      },
    )
  }
}

/**
 * DELETE /api/v1/admin/state-consent-rules/{ruleId}
 * Permanently delete a draft rule. Only works if status='draft'.
 */
export const DELETE = async ({ request, cookies, params }: BaseAPIContext) => {
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

    const actor = buildActor(admin)

    const deleted = await stateConsentRulesRepository.delete(ruleId, actor)
    if (!deleted) {
      return new Response(
        JSON.stringify({ error: 'Rule not found or not in draft status' }),
        {
          status: 404,
          headers: JSON_HEADERS,
        },
      )
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: JSON_HEADERS,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: 'Failed to delete rule', detail: message }),
      {
        status: 500,
        headers: JSON_HEADERS,
      },
    )
  }
}
