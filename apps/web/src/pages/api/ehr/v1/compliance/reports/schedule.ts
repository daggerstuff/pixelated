/**
 * Compliance Report Schedule API
 *
 * POST   /api/ehr/v1/compliance/reports/schedule — Create a scheduled report
 * GET    /api/ehr/v1/compliance/reports/schedule — List scheduled reports
 * DELETE /api/ehr/v1/compliance/reports/schedule — Delete a scheduled report
 */

import {
  resolveTenantId,
  requireEHRPermission,
  ehrValidationError,
  ehrSuccess,
  ehrCreated,
  ehrPaginated,
  ehrNotFound,
  sanitizeLimitParam,
  sanitizeOffsetParam,
} from '@/lib/ehr-native/api'
import {
  createScheduledReport,
  listScheduledReports,
  deleteScheduledReport,
  getScheduledReport,
  triggerScheduledReportNow,
} from '@/lib/ehr-native/compliance'
import type {
  ReportType,
  ReportSchedule,
  ReportFormat,
} from '@/lib/ehr-native/compliance'
import { withV1Contract } from '@/lib/middleware/with-v1-contract'

// ---------------------------------------------------------------------------
// POST — Create a scheduled report
// ---------------------------------------------------------------------------

export const POST = withV1Contract(
  'createScheduledReport',
  async (ctx, caller) => {
    const tenantId = resolveTenantId(caller.user.accountId)
    if (!tenantId) {
      return ehrValidationError('Tenant association required for EHR access.')
    }

    const raw = await ctx.request.json().catch(() => null)
    if (!raw) {
      return ehrValidationError('Request body must be valid JSON.')
    }

    const { type, schedule, emailRecipients, format, dayOfMonth, triggerNow } =
      raw as {
        type?: string
        schedule?: string
        emailRecipients?: string[]
        format?: string
        dayOfMonth?: number
        triggerNow?: boolean
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

    const validSchedules: ReportSchedule[] = [
      'monthly',
      'quarterly',
      'annual',
      'ad-hoc',
    ]
    if (!schedule || !validSchedules.includes(schedule as ReportSchedule)) {
      return ehrValidationError(
        `Invalid schedule. Must be one of: ${validSchedules.join(', ')}.`,
      )
    }

    if (
      !emailRecipients ||
      !Array.isArray(emailRecipients) ||
      emailRecipients.length === 0
    ) {
      return ehrValidationError('At least one email recipient is required.')
    }

    for (const email of emailRecipients) {
      if (typeof email !== 'string' || !email.includes('@')) {
        return ehrValidationError(`Invalid email address: ${String(email)}`)
      }
    }

    const validFormats: ReportFormat[] = ['pdf', 'csv', 'json']
    const fmt: ReportFormat = validFormats.includes(format as ReportFormat)
      ? (format as ReportFormat)
      : 'pdf'

    const dom =
      typeof dayOfMonth === 'number' && dayOfMonth >= 1 && dayOfMonth <= 28
        ? dayOfMonth
        : 1

    const perm = await requireEHRPermission(
      caller.user.role,
      'audit_access',
      caller.user.id,
      tenantId,
    )
    if (!perm.allowed) return perm.response

    const config = createScheduledReport(
      type as ReportType,
      schedule as ReportSchedule,
      tenantId,
      emailRecipients,
      fmt,
      dom,
    )

    if (triggerNow) {
      try {
        await triggerScheduledReportNow(config.scheduleId)
      } catch {
        // Non-fatal: the schedule was still created
      }
    }

    return ehrCreated(config)
  },
)

// ---------------------------------------------------------------------------
// GET — List scheduled reports
// ---------------------------------------------------------------------------

export const GET = withV1Contract(
  'listScheduledReports',
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

    const url = new URL(ctx.request.url)
    const limit = sanitizeLimitParam(
      Number(url.searchParams.get('limit') ?? 50),
    )
    const offset = sanitizeOffsetParam(
      Number(url.searchParams.get('offset') ?? 0),
    )

    const all = listScheduledReports(tenantId)
    const paged = all.slice(offset, offset + limit)

    return ehrPaginated(paged, { limit, offset, total: all.length })
  },
)

// ---------------------------------------------------------------------------
// DELETE — Delete a scheduled report
// ---------------------------------------------------------------------------

export const DELETE = withV1Contract(
  'deleteScheduledReport',
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

    const raw = await ctx.request.json().catch(() => null)
    if (!raw) {
      return ehrValidationError('Request body must be valid JSON.')
    }

    const { scheduleId } = raw as { scheduleId?: string }
    if (!scheduleId) {
      return ehrValidationError('scheduleId is required.')
    }

    const schedule = getScheduledReport(scheduleId)
    if (!schedule || schedule.tenantId !== tenantId) {
      return ehrNotFound('Scheduled report', scheduleId)
    }

    deleteScheduledReport(scheduleId)

    return ehrSuccess({ scheduleId, deleted: true })
  },
)
