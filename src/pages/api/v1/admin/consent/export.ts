import { consentManagementService } from '@/lib/research/services/ConsentManagementService'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

import { protectRoute } from '../../../../../lib/auth/serverAuth'

export const prerender = false
const logger = createBuildSafeLogger('admin-consent-export-api')

/**
 * GET /api/v1/admin/consent/export
 * Exports all consent data for compliance reporting.
 * Returns consentRecords, auditLog, and statistics.
 */
export const GET = protectRoute({
  requiredRole: 'admin',
  validateIPMatch: true,
  validateUserAgent: true,
})(async () => {
  try {
    const data = await consentManagementService.exportConsentData()

    logger.info('Consent data exported', {
      records: data.consentRecords.length,
      auditEntries: data.auditLog.length,
    })

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  } catch (error) {
    logger.error('Failed to export consent data', { error: String(error) })
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  }
})
