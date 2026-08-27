import {
  resolveTenantId,
  requireEHRPermission,
  ehrValidationError,
  ehrSuccess,
  sanitizeFhirId,
} from '@/lib/ehr-native/api'
import { OutcomesService } from '@/lib/ehr-native/services'
import { withV1Contract } from '@/lib/middleware/with-v1-contract'

/**
 * GET /api/ehr/v1/outcomes/alerts
 * Retrieves all active alerts for a patient across all measure types.
 * Alerts are triggered when a measure shows significant deterioration
 * (or improvement for OQ-45, RCI = 14).
 *
 * Query params:
 *   patient (required) — patient ID
 * @returns 200 with OutcomeAlertResult[], or 403/400
 */
export const GET = withV1Contract('getOutcomeAlerts', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId)
    return ehrValidationError('Tenant association required for EHR access.')

  const url = new URL(ctx.request.url)
  const rawPatientId = url.searchParams.get('patient') ?? undefined

  if (!rawPatientId)
    return ehrValidationError('patient query parameter is required.')

  const patientId = sanitizeFhirId(rawPatientId, 'patient ID')

  const perm = await requireEHRPermission(
    caller.user.role,
    'read_observation',
    caller.user.id,
    tenantId,
    patientId,
  )
  if (!perm.allowed) return perm.response

  const service = new OutcomesService(perm.rlsContext)

  try {
    const alerts = await service.getAlerts(patientId)
    return ehrSuccess(alerts)
  } catch (err) {
    return ehrValidationError(
      err instanceof Error ? err.message : 'Failed to retrieve alerts.',
    )
  }
})
