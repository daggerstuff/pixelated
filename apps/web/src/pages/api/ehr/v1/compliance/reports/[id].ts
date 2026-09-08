/**
 * Compliance Report Detail API
 *
 * GET /api/ehr/v1/compliance/reports/[id] — Fetch a specific report by ID
 *
 * Note: Reports are generated on-demand and not persisted to a database
 * in the current implementation. This endpoint returns the report
 * metadata from the in-memory store if available, or 404 if not found.
 */

import {
  resolveTenantId,
  requireEHRPermission,
  ehrValidationError,
  ehrNotFound,
  ehrSuccess,
} from '@/lib/ehr-native/api'
import { getScheduledReport } from '@/lib/ehr-native/compliance'
import { withV1Contract } from '@/lib/middleware/with-v1-contract'

export const GET = withV1Contract(
  'getComplianceReport',
  async (ctx, caller) => {
    const tenantId = resolveTenantId(caller.user.accountId)
    if (!tenantId) {
      return ehrValidationError('Tenant association required for EHR access.')
    }

    const perm = await requireEHRPermission(
      caller.user.role,
      'audit_access',
      caller.user.id,
      tenantId,
    )
    if (!perm.allowed) return perm.response

    // Extract report ID from URL params
    const url = new URL(ctx.request.url)
    const pathParts = url.pathname.split('/')
    const reportId = pathParts[pathParts.length - 1]

    if (!reportId) {
      return ehrValidationError('Report ID is required.')
    }

    // Check if this is a scheduled report ID
    if (reportId.startsWith('sch-')) {
      const schedule = getScheduledReport(reportId)
      if (!schedule || schedule.tenantId !== tenantId) {
        return ehrNotFound('Scheduled report', reportId)
      }
      return ehrSuccess(schedule)
    }

    // For generated reports, we return 404 since they're not persisted
    // In a production system, this would query a reports table
    return ehrNotFound('Report', reportId)
  },
)
