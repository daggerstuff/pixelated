/** EHR Native — Appointments Collection API (F1.6) */
import { withV1Contract } from '@/lib/middleware/with-v1-contract'
import { resolveTenantId, requireEHRPermission, ehrCreated, ehrValidationError, ehrPaginated } from '@/lib/ehr-native/api'
import { SchedulingService, type CreateAppointmentInput } from '@/lib/ehr-native/services'

/**
 * GET /api/ehr/v1/appointments
 * List appointments by patient, status, date range, or practitioner schedule.
 * @returns 200 with appointment list, or 403/400
 */
export const GET = withV1Contract('listAppointments', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId) return ehrValidationError('Tenant association required for EHR access.')
  const perm = await requireEHRPermission(caller.user.role, 'read_schedule', caller.user.id, tenantId)
  if (!perm.allowed) return perm.response
  const service = new SchedulingService(perm.rlsContext)

  const url = new URL(ctx.request.url)
  const patientId = url.searchParams.get('patient') ?? undefined
  const status = url.searchParams.get('status') ?? undefined
  const practitioner = url.searchParams.get('practitioner') ?? undefined
  const startDate = url.searchParams.get('start') ?? undefined
  const endDate = url.searchParams.get('end') ?? undefined
  const upcoming = url.searchParams.get('upcoming') === 'true'
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 1), 200)
  const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10) || 0, 0)

  let appointments
  if (patientId) {
    appointments = await service.getPatientAppointments(patientId, { limit, offset })
  } else if (practitioner) {
    appointments = await service.getPractitionerSchedule(practitioner, { upcomingOnly: upcoming, limit, offset })
  } else if (status) {
    appointments = await service.getAppointmentsByStatus(status, { limit, offset })
  } else if (startDate && endDate) {
    appointments = await service.getAppointmentsByDateRange({ start: startDate, end: endDate, limit, offset })
  } else {
    return ehrValidationError('Provide at least one filter: patient, practitioner, status, or start+end.')
  }
  return ehrPaginated(appointments, { limit, offset, total: appointments.length })
})

/**
 * POST /api/ehr/v1/appointments
 * Create a new appointment.
 * @returns 201 with created appointment, or 403/400
 */
export const POST = withV1Contract('createAppointment', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId) return ehrValidationError('Tenant association required for EHR access.')
  const perm = await requireEHRPermission(caller.user.role, 'manage_schedule', caller.user.id, tenantId)
  if (!perm.allowed) return perm.response
  const service = new SchedulingService(perm.rlsContext)

  const raw = await ctx.request.json().catch(() => null)
  if (!raw) return ehrValidationError('Request body must be valid JSON.')

  try {
    const appointment = await service.createAppointment(raw as CreateAppointmentInput)
    return ehrCreated(appointment)
  } catch (err) {
    return ehrValidationError(err instanceof Error ? err.message : 'Invalid appointment input.')
  }
})
