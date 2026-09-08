/**
 * Compliance Report CSV Export API
 *
 * POST /api/ehr/v1/compliance/reports/export/csv — Export a report as CSV
 *
 * Request body: { type, startDate, endDate }
 * Response: text/csv
 */

import {
  resolveTenantId,
  requireEHRPermission,
  ehrValidationError,
  sanitizeIsoTimestamp,
} from '@/lib/ehr-native/api'
import { generateReport, exportReportToCSV } from '@/lib/ehr-native/compliance'
import type { ReportType } from '@/lib/ehr-native/compliance'
import { withV1Contract } from '@/lib/middleware/with-v1-contract'

export const POST = withV1Contract(
  'exportComplianceReportCSV',
  async (ctx, caller) => {
    const tenantId = resolveTenantId(caller.user.accountId)
    if (!tenantId) {
      return ehrValidationError('Tenant association required for EHR access.')
    }

    const raw = await ctx.request.json().catch(() => null)
    if (!raw) {
      return ehrValidationError('Request body must be valid JSON.')
    }

    const { type, startDate, endDate } = raw as {
      type?: string
      startDate?: string
      endDate?: string
    }

    const validTypes: ReportType[] = [
      'hipaa_audit',
      'soc2_security',
      'soc2_availability',
      'consent_compliance',
      'access_review',
    ]
    if (!type || !validTypes.includes(type as ReportType)) {
      return ehrValidationError(
        `Invalid report type. Must be one of: ${validTypes.join(', ')}.`,
      )
    }

    if (!startDate || !endDate) {
      return ehrValidationError('Both startDate and endDate are required.')
    }

    const start = sanitizeIsoTimestamp(startDate, 'startDate')
    const end = sanitizeIsoTimestamp(endDate, 'endDate')

    if (new Date(start) > new Date(end)) {
      return ehrValidationError('startDate must be before or equal to endDate.')
    }

    const perm = await requireEHRPermission(
      caller.user.role,
      'export_phi',
      caller.user.id,
      tenantId,
    )
    if (!perm.allowed) return perm.response

    try {
      const { report, metadata } = await generateReport({
        type: type as ReportType,
        period: { startDate: start, endDate: end },
        tenantId,
        format: 'csv',
        requestedBy: caller.user.id,
      })

      const csvString = await exportReportToCSV(report, metadata)
      const filename = `compliance-${type}-${start.slice(0, 10)}.csv`

      return new Response(csvString, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return ehrValidationError(`Failed to export CSV: ${message}`)
    }
  },
)
