/**
 * Portal — Scheduling Item API (F1.11)
 *
 * GET  /api/portal/v1/scheduling/[id]     — get appointment detail
 * POST /api/portal/v1/scheduling/[id]     — cancel or reschedule (via action body)
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
import { SchedulingService } from '@/lib/ehr-native/services'
import { withV1Contract } from '@/lib/middleware/with-v1-contract'

/**
 * GET /api/portal/v1/scheduling/[id]
 * Get a specific appointment by ID.
 * @returns 200 with appointment, or 403/404
 */
export const GET = withV1Contract(
  'portalGetAppointment',
  async (ctx, caller) => {
    const appointmentId = ctx.params?.['id']
    if (!appointmentId) return ehrValidationError('Appointment ID is required.')

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

    const service = new SchedulingService(guard.rlsContext)
    const appointment = await service.getAppointment(appointmentId)
    if (!appointment) return ehrNotFound('Appointment', appointmentId)

    return ehrSuccess(appointment)
  },
)

/**
 * POST /api/portal/v1/scheduling/[id]
 * Cancel or reschedule an appointment (action-based dispatch).
 * @returns 200 with updated appointment, or 403/404/400
 */
export const POST = withV1Contract(
  'portalUpdateAppointment',
  async (ctx, caller) => {
    const appointmentId = ctx.params?.['id']
    if (!appointmentId) return ehrValidationError('Appointment ID is required.')

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

    const body = raw as Record<string, unknown>
    const action = body['action'] as string | undefined

    const service = new SchedulingService(guard.rlsContext)

    try {
      let appointment
      switch (action ?? '') {
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
        default:
          return ehrValidationError(
            'Unsupported action. Use cancel or reschedule.',
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
