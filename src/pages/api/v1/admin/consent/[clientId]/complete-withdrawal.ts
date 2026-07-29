import { consentManagementService } from '@/lib/research/services/ConsentManagementService'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

import { protectRoute } from '../../../../../../lib/auth/serverAuth'

export const prerender = false
const logger = createBuildSafeLogger('admin-consent-withdrawal-api')

/**
 * POST /api/v1/admin/consent/:clientId/complete-withdrawal
 * Complete consent withdrawal and trigger data purge.
 */
export const POST = protectRoute({
  requiredRole: 'admin',
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({ params }) => {
  try {
    const clientId = params['clientId'] as string

    await consentManagementService.completeWithdrawal(clientId)

    logger.info('Consent withdrawal completed', { clientId })

    return new Response(JSON.stringify({ success: true, clientId, message: 'Withdrawal completed and data purge triggered' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  } catch (error) {
    logger.error('Failed to complete withdrawal', { error: String(error) })
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }), {
      status: error instanceof Error ? 400 : 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  }
})
