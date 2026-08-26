/**
 * Portal — Statement Item API (F1.11)
 *
 * GET /api/portal/v1/statements/[statementId]  — get statement detail
 * GET /api/portal/v1/statements/[statementId]?format=csv  — download CSV
 */

import type { UserRole } from '@/lib/auth/roles'
import {
  resolveTenantId,
  ehrSuccess,
  ehrValidationError,
  ehrNotFound,
} from '@/lib/ehr-native/api'
import {
  requirePortalClient,
  resolvePortalPatientId,
} from '@/lib/ehr-native/auth/portal-guard'
import { PortalStatementService } from '@/lib/ehr-native/services'
import { withV1Contract } from '@/lib/middleware/with-v1-contract'

/**
 * GET /api/portal/v1/statements/[statementId]
 * Get a specific patient statement.
 * Pass ?format=csv to download as CSV file.
 * @returns 200 with statement (JSON) or CSV file, or 403/404
 */
export const GET = withV1Contract('portalGetStatement', async (ctx, caller) => {
  const statementId = ctx.params?.['statementId']
  if (!statementId) return ehrValidationError('Statement ID is required.')

  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId)
    return ehrValidationError('Tenant association required for portal access.')

  const guard = requirePortalClient(
    caller.user.role as UserRole,
    caller.user.id,
    tenantId,
  )
  if (!guard.allowed) return guard.response

  const patientId = resolvePortalPatientId(caller.user.id)
  const url = new URL(ctx.request.url)
  const format = url.searchParams.get('format')

  const service = new PortalStatementService(guard.rlsContext)

  if (format === 'csv') {
    const download = await service.downloadStatement(statementId, patientId)
    if (!download) return ehrNotFound('Statement', statementId)

    return new Response(download.data, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${download.filename}"`,
      },
    })
  }

  const statement = await service.getStatement(statementId, patientId)
  if (!statement) return ehrNotFound('Statement', statementId)

  return ehrSuccess(statement)
})
