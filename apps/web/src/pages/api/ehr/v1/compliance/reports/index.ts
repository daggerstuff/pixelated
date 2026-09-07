/**
 * Compliance Reports API
 *
 * POST  /api/ehr/v1/compliance/reports        — Generate an ad-hoc compliance report
 * GET   /api/ehr/v1/compliance/reports         — List scheduled report configurations
 */

import { withV1Contract } from '@/lib/middleware/with-v1-contract'
import {
  resolveTenantId,
  requireEHRPermission,
  ehrValidationError,
  ehrSuccess,
  ehrPaginated,
  sanitizeIsoTimestamp,
} from '@/lib/ehr-native/api'
import {
  generateReport,
  listScheduledReports,
} from '@/lib/ehr-native/compliance'
import type { ReportType } from '@/lib/ehr-native/compliance'

// ---------------------------------------------------------------------------
// POST — Generate ad-hoc compliance report
// ---------------------------------------------------------------------------

export const POST = withV1Contract(
  'generateComplianceReport',
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

    // Validate report type
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

    // Validate dates
    if (!startDate || !endDate) {
      return ehrValidationError('Both startDate and endDate are required.')
    }

    const start = sanitizeIsoTimestamp(startDate, 'startDate')
    const end = sanitizeIsoTimestamp(endDate, 'endDate')

    if (new Date(start) > new Date(end)) {
      return ehrValidationError('startDate must be before or equal to endDate.')
    }

    // Require audit_access permission to generate reports
    const perm = await requireEHRPermission(
      caller.user.role,
      'audit_access',
      caller.user.id,
      tenantId,
    )
    if (!perm.allowed) return perm.response

    // Generate the report
    try {
      const { metadata } = await generateReport({
        type: type as ReportType,
        period: { startDate: start, endDate: end },
        tenantId,
        requestedBy: caller.user.id,
      })

      return ehrSuccess(metadata)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return ehrValidationError(`Failed to generate report: ${message}`)
    }
  },
)

// ---------------------------------------------------------------------------
// GET — List scheduled report configurations
// ---------------------------------------------------------------------------

export const GET = withV1Contract(
  'listScheduledReports',
  async (_ctx, caller) => {
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

    const schedules = listScheduledReports(tenantId)

    return ehrPaginated(schedules, {
      limit: schedules.length,
      offset: 0,
      total: schedules.length,
    })
  },
)
