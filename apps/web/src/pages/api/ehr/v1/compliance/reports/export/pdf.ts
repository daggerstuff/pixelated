/**
 * Compliance Report PDF Export API
 *
 * POST /api/ehr/v1/compliance/reports/export/pdf — Export a report as PDF
 *
 * Request body: { type, startDate, endDate }
 * Response: application/pdf
 */

import { withV1Contract } from '@/lib/middleware/with-v1-contract'
import {
  resolveTenantId,
  requireEHRPermission,
  ehrValidationError,
  sanitizeIsoTimestamp,
} from '@/lib/ehr-native/api'
import { generateReport, exportReportToPDF } from '@/lib/ehr-native/compliance'
import type { ReportType } from '@/lib/ehr-native/compliance'

export const POST = withV1Contract(
  'exportComplianceReportPDF',
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

    // Require export_phi permission for PDF export
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
        format: 'pdf',
        requestedBy: caller.user.id,
      })

      // Export to PDF
      const pdfBuffer = await exportReportToPDF(report, metadata)

      const filename = `compliance-${type}-${start.slice(0, 10)}.pdf`

      return new Response(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(pdfBuffer.length),
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return ehrValidationError(`Failed to export PDF: ${message}`)
    }
  },
)
