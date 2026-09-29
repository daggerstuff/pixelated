import { verifyAdmin } from '@/lib/admin/middleware'
import type { BaseAPIContext } from '@/lib/auth/apiRouteTypes'
import {
  stateConsentRulesRepository,
  mapAdminRoleToEhrRole,
  type ActorContext,
} from '@/lib/ehr-native/consent/state-rules/repository'
import {
  safeValidateStateRuleConfig,
  CreateStateRuleInputSchema,
  type RuleStatus,
} from '@/lib/ehr-native/consent/state-rules/schemas'

export const prerender = false

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
}

function buildActor(
  admin: { userId: string; role: string },
  tenantId?: string | null,
): ActorContext {
  return {
    userId: admin.userId,
    role: mapAdminRoleToEhrRole(admin.role),
    tenantId: tenantId ?? undefined,
  }
}

/**
 * GET /api/v1/admin/state-consent-rules
 * List state consent rules with optional filters.
 * Query: stateCode, status, tenantId, page, limit
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
    const stateCode = searchParams.get('stateCode')?.toUpperCase() ?? undefined
    const statusParam = searchParams.get('status') ?? undefined
    const tenantId = searchParams.get('tenantId')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)),
    )

    const status = statusParam as RuleStatus | undefined

    const rules = await stateConsentRulesRepository.list({
      stateCode,
      status,
      tenantId: tenantId ?? undefined,
      page,
      limit,
    })

    return new Response(
      JSON.stringify({
        rules,
        total: rules.length,
        page,
        limit,
      }),
      {
        status: 200,
        headers: JSON_HEADERS,
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({
        error: 'Failed to list state consent rules',
        detail: message,
      }),
      {
        status: 500,
        headers: JSON_HEADERS,
      },
    )
  }
}

/**
 * POST /api/v1/admin/state-consent-rules
 * Create a new draft state consent rule.
 * Body: { stateCode, ruleConfig, tenantId?, effectiveDate?, expiryDate?, notes? }
 */
export const POST = async ({ request, cookies }: BaseAPIContext) => {
  const admin = await verifyAdmin({ request, cookies } as BaseAPIContext)
  if (!admin) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: JSON_HEADERS,
    })
  }

  try {
    const body = await request.json()

    const parsed = CreateStateRuleInputSchema.safeParse(body)
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: 'Validation failed',
          details: parsed.error.issues,
        }),
        {
          status: 400,
          headers: JSON_HEADERS,
        },
      )
    }

    const configResult = safeValidateStateRuleConfig(parsed.data.ruleConfig)
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

    const actor = buildActor(admin, parsed.data.tenantId)

    const rule = await stateConsentRulesRepository.createDraft(
      {
        stateCode: parsed.data.stateCode,
        ruleConfig: configResult.data,
        tenantId: parsed.data.tenantId ?? undefined,
        effectiveDate: parsed.data.effectiveDate,
        expiryDate: parsed.data.expiryDate,
        notes: parsed.data.notes,
      },
      actor,
    )

    return new Response(JSON.stringify({ rule }), {
      status: 201,
      headers: JSON_HEADERS,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({
        error: 'Failed to create state consent rule',
        detail: message,
      }),
      {
        status: 500,
        headers: JSON_HEADERS,
      },
    )
  }
}
