import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { consentManagementService } from '@/lib/research/services/ConsentManagementService'
import type { ConsentRecord } from '@/lib/research/types/research-types'

import { protectRoute } from '../../../../../lib/auth/serverAuth'

export const prerender = false
const logger = createBuildSafeLogger('admin-consent-api')

/**
 * GET /api/v1/admin/consent
 * Returns all consent records + statistics.
 * Admin-only, no-store headers (PHI boundary).
 */
export const GET = protectRoute({
  requiredRole: 'admin',
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({ request }) => {
  try {
    const searchParams = new URL(request.url).searchParams
    const clientId = searchParams.get('clientId')

    if (clientId) {
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
    }

    const statistics = await consentManagementService.getConsentStatistics()
    const auditTrail = await consentManagementService.getAuditTrail()
    const clientIds = new Set(
      auditTrail.map((entry: { clientId: string }) => entry.clientId),
    )
    const records: ConsentRecord[] = []
    for (const id of clientIds) {
      const record = await consentManagementService.getConsentRecord(id)
      if (record) {
        records.push(record)
      }
    }

    logger.info('Consent records requested', { count: records.length })

    return new Response(JSON.stringify({ records, statistics }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    logger.error('Failed to fetch consent records', { error: String(error) })
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
 * POST /api/v1/admin/consent
 * Initialize consent for a new client.
 * Body: { clientId, level?, metadata? }
 */
export const POST = protectRoute({
  requiredRole: 'admin',
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({ request }) => {
  try {
    const body = await request.json()
    const { clientId, level, metadata } = body

    if (!clientId || typeof clientId !== 'string') {
      return new Response(JSON.stringify({ error: 'clientId is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      })
    }

    const record = await consentManagementService.initializeConsent(
      clientId,
      level ?? 'minimal',
      metadata,
    )

    logger.info('Consent initialized', { clientId, level: record.currentLevel })

    return new Response(JSON.stringify(record), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    logger.error('Failed to initialize consent', { error: String(error) })
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  }
})
