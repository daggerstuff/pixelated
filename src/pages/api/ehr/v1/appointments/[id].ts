import {
  resolveTenantId,
  requireEHRPermission,
  ehrSuccess,
  ehrValidationError,
  ehrNotFound,
} from '@/lib/ehr-native/api'
import {
  SchedulingService,
  type UpdateAppointmentInput,
} from '@/lib/ehr-native/services'
/** EHR Native — Appointment Item API (F1.6) */
import { withV1Contract } from '@/lib/middleware/with-v1-contract'

/**
 * GET /api/ehr/v1/appointments/[id]
 * Get an appointment by ID.
 * @returns 200 with appointment, or 403/404
 */
export const GET = withV1Contract('getAppointment', async (ctx, caller) => {
  const appointmentId = ctx.params?.['id']
  if (!appointmentId) return ehrValidationError('Appointment ID is required.')
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId)
    return ehrValidationError('Tenant association required for EHR access.')
  const perm = await requireEHRPermission(
    caller.user.role,
    'read_schedule',
    caller.user.id,
    tenantId,
  )
  if (!perm.allowed) return perm.response
  const service = new SchedulingService(perm.rlsContext)

  const appointment = await service.getAppointment(appointmentId)
  if (!appointment) return ehrNotFound('Appointment', appointmentId)
  return ehrSuccess(appointment)
})

/**
 * PATCH /api/ehr/v1/appointments/[id]
 * Update, cancel, reschedule, check-in, complete, or no-show an appointment.
 * Pass `action` in the body to invoke a lifecycle method.
 * @returns 200 with updated appointment, or 403/404/400
 */
export const PATCH = withV1Contract(
  'updateAppointment',
  async (ctx, caller) => {
    const appointmentId = ctx.params?.['id']
    if (!appointmentId) return ehrValidationError('Appointment ID is required.')
    const tenantId = resolveTenantId(caller.user.accountId)
    if (!tenantId)
      return ehrValidationError('Tenant association required for EHR access.')
    const perm = await requireEHRPermission(
      caller.user.role,
      'manage_schedule',
      caller.user.id,
      tenantId,
    )
    if (!perm.allowed) return perm.response
    const service = new SchedulingService(perm.rlsContext)

    const raw = await ctx.request.json().catch(() => null)
    if (!raw || typeof raw !== 'object')
      return ehrValidationError('Request body must be a JSON object.')

    const body = raw as Record<string, unknown>
    const action = body['action'] as string | undefined

    try {
      let appointment
      switch (action) {
        case 'cancel':
          appointment = await service.cancelAppointment(
            appointmentId,
            body['reason'] as string | undefined,
          )
          break
        case 'reschedule': {
          const start = body['start'] as string | undefined
          const end = body['end'] as string | undefined
          if (!start || !end)
            return ehrValidationError('Reschedule requires start and end.')
          appointment = await service.rescheduleAppointment(
            appointmentId,
            start,
            end,
          )
          break
        }
        case 'check-in':
          appointment = await service.checkInAppointment(appointmentId)
          break
        case 'complete':
          appointment = await service.completeAppointment(appointmentId)
          break
        case 'no-show':
          appointment = await service.markNoShow(appointmentId)
          break
        default:
          appointment = await service.updateAppointment(
            appointmentId,
            raw as UpdateAppointmentInput,
          )
      }
      if (!appointment) return ehrNotFound('Appointment', appointmentId)
      return ehrSuccess(appointment)
    } catch (err) {
      return ehrValidationError(
        err instanceof Error ? err.message : 'Appointment update failed.',
      )
    }
  },
)
