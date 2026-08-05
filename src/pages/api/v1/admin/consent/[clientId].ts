import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { consentManagementService } from '@/lib/research/services/ConsentManagementService'

import { protectRoute } from '../../../../../lib/auth/serverAuth'

export const prerender = false
const logger = createBuildSafeLogger('admin-consent-client-api')

/**
 * GET /api/v1/admin/consent/:clientId
 * Returns the consent record for a specific client.
 */
export const GET = protectRoute({
  requiredRole: 'admin',
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({ params }) => {
  try {
    const clientId = params['clientId'] as string
    const record = await consentManagementService.getConsentRecord(clientId)

    if (!record) {
      return new Response(
        JSON.stringify({ error: 'Consent record not found' }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        },
      )
    }

    return new Response(JSON.stringify(record), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    logger.error('Failed to fetch consent record', { error: String(error) })
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  }
})

/**
 * PATCH /api/v1/admin/consent/:clientId
 * Update consent level for a client.
 * Body: { newLevel, reason?, effectiveDate? }
 */
export const PATCH = protectRoute({
  requiredRole: 'admin',
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({ params, request }) => {
  try {
    const clientId = params['clientId'] as string
    const body = await request.json()
    const { newLevel, reason, effectiveDate } = body

    if (!newLevel) {
      return new Response(JSON.stringify({ error: 'newLevel is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      })
    }

    const record = await consentManagementService.updateConsent({
      clientId,
      newLevel,
      reason,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : undefined,
    })

    logger.info('Consent updated', { clientId, newLevel })

    return new Response(JSON.stringify(record), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    logger.error('Failed to update consent', { error: String(error) })
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: error instanceof Error ? 400 : 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      },
    )
  }
})

/**
 * DELETE /api/v1/admin/consent/:clientId
 * Request consent withdrawal for a client.
 * Body: { reason?, immediate? }
 */
export const DELETE = protectRoute({
  requiredRole: 'admin',
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({ params, request }) => {
  try {
    const clientId = params['clientId'] as string
    let body: { reason?: string; immediate?: boolean } = {}
    try {
      body = await request.json()
    } catch {
      // Body is optional for DELETE
    }

    const result = await consentManagementService.requestWithdrawal(
      clientId,
      body.reason,
      body.immediate ?? false,
    )

    logger.info('Consent withdrawal requested', {
      clientId,
      immediate: body.immediate,
    })

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    logger.error('Failed to request withdrawal', { error: String(error) })
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: error instanceof Error ? 400 : 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      },
    )
  }
})
