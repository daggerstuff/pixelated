import { consentManagementService } from '@/lib/research/services/ConsentManagementService'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

import { protectRoute } from '../../../../../lib/auth/serverAuth'

export const prerender = false
const logger = createBuildSafeLogger('admin-consent-audit-api')

/**
 * GET /api/v1/admin/consent/audit
 * Returns the HIPAA-compliant audit trail for consent operations.
 * Query params: clientId (optional, filters to specific client)
 */
export const GET = protectRoute({
  requiredRole: 'admin',
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({ request }) => {
  try {
    const searchParams = new URL(request.url).searchParams
    const clientId = searchParams.get('clientId') ?? undefined

    const auditTrail = await consentManagementService.getAuditTrail(clientId)

    logger.info('Audit trail requested', { clientId: clientId ?? 'all', entries: auditTrail.length })

    return new Response(JSON.stringify({ auditTrail, count: auditTrail.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  } catch (error) {
    logger.error('Failed to fetch audit trail', { error: String(error) })
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  }
})
