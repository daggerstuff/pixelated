/**
 * Portal — Scheduling API (F1.11)
 *
 * Self-scheduling endpoints for client portal. Uses existing SchedulingService
 * but enforces portal guard (ehr:client role) instead of requireEHRPermission.
 *
 * GET  /api/portal/v1/scheduling       — list patient appointments
 * POST /api/portal/v1/scheduling       — create new appointment (self-schedule)
 */

import type { UserRole } from '@/lib/auth/roles'
import {
  resolveTenantId,
  sanitizeLimitParam,
  sanitizeOffsetParam,
  sanitizeSearchParam,
  ehrValidationError,
  ehrPaginated,
  ehrCreated,
} from '@/lib/ehr-native/api'
import {
  requirePortalClient,
  resolvePortalPatientId,
} from '@/lib/ehr-native/auth/portal-guard'
import { SchedulingService } from '@/lib/ehr-native/services'
import { withV1Contract } from '@/lib/middleware/with-v1-contract'

/**
 * GET /api/portal/v1/scheduling
 * List the authenticated patient's appointments.
 * @returns 200 with paginated appointments, or 403/400
 */
export const GET = withV1Contract(
  'portalListAppointments',
  async (ctx, caller) => {
    const tenantId = resolveTenantId(caller.user.accountId)
    if (!tenantId)
      return ehrValidationError(
        'Tenant association required for portal access.',
      )

    const guard = requirePortalClient(
      caller.user.role as UserRole,
      caller.user.id,
      tenantId,
    )
    if (!guard.allowed) return guard.response

    const patientId = resolvePortalPatientId(caller.user.id)
    const url = new URL(ctx.request.url)
    const limit = sanitizeLimitParam(
      Number(url.searchParams.get('limit') ?? '50'),
      100,
    )
    const offset = sanitizeOffsetParam(
      Number(url.searchParams.get('offset') ?? '0'),
    )
    const status = sanitizeSearchParam(url.searchParams.get('status') ?? '')

    const service = new SchedulingService(guard.rlsContext)
    const result = await service.getPatientAppointments(patientId, {
      limit,
      offset,
    })

    // Filter by status in application code — SchedulingService.getPatientAppointments
    // does not support status filtering in its ScheduleSearchParams type.
    const filtered = status
      ? result.filter((apt) => apt.status === status)
      : result

    return ehrPaginated(filtered, {
      limit,
      offset,
      total: filtered.length,
    })
  },
)

/**
 * POST /api/portal/v1/scheduling
 * Self-schedule a new appointment.
 * @returns 201 with created appointment, or 403/400
 */
export const POST = withV1Contract(
  'portalCreateAppointment',
  async (ctx, caller) => {
    const tenantId = resolveTenantId(caller.user.accountId)
    if (!tenantId)
      return ehrValidationError(
        'Tenant association required for portal access.',
      )

    const guard = requirePortalClient(
      caller.user.role as UserRole,
      caller.user.id,
      tenantId,
    )
    if (!guard.allowed) return guard.response

    const raw = await ctx.request.json().catch(() => null)
    if (!raw || typeof raw !== 'object')
      return ehrValidationError('Request body must be a JSON object.')

    const patientId = resolvePortalPatientId(caller.user.id)
    const body = raw as Record<string, unknown>

    // Ensure the FHIR resource references the authenticated patient
    const fhirResource = body['fhirResource'] as
      | Record<string, unknown>
      | undefined
    if (!fhirResource) return ehrValidationError('fhirResource is required.')

    // Security: Override patient participant reference with authenticated user's ID
    // to prevent IDOR — patients can only schedule appointments for themselves.
    const patientRef = `Patient/${patientId}`
    if (Array.isArray(fhirResource['participant'])) {
      let foundPatient = false
      for (const p of fhirResource['participant'] as Array<
        Record<string, unknown>
      >) {
        const actor = p['actor'] as Record<string, unknown> | undefined
        if (
          actor &&
          typeof actor['reference'] === 'string' &&
          actor['reference'].startsWith('Patient/')
        ) {
          actor['reference'] = patientRef
          foundPatient = true
        }
      }
      if (!foundPatient) {
        ;(fhirResource['participant'] as Array<Record<string, unknown>>).push({
          actor: { reference: patientRef },
          status: 'needs-action',
        })
      }
    }

    const service = new SchedulingService(guard.rlsContext)

    try {
      const appointment = await service.createAppointment({
        fhirResource,
      })
      return ehrCreated(appointment)
    } catch (err) {
      return ehrValidationError(
        err instanceof Error ? err.message : 'Failed to create appointment.',
      )
    }
  },
)
