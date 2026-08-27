import {
  resolveTenantId,
  requireEHRPermission,
  ehrValidationError,
  ehrSuccess,
  sanitizeFhirId,
  sanitizeSearchParam,
} from '@/lib/ehr-native/api'
import { OutcomesService } from '@/lib/ehr-native/services'
import type { OutcomeMeasureType } from '@/lib/ehr-native/types'
import { withV1Contract } from '@/lib/middleware/with-v1-contract'

/**
 * GET /api/ehr/v1/outcomes/trending
 * Retrieves trending data for a specific patient and measure type.
 *
 * Query params:
 *   patient (required) — patient ID
 *   measure (required) — 'phq-9' | 'gad-7' | 'oq-45'
 * @returns 200 with trend data, or 403/400
 */
export const GET = withV1Contract('getOutcomeTrend', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId)
    return ehrValidationError('Tenant association required for EHR access.')

  const url = new URL(ctx.request.url)
  const rawPatientId = url.searchParams.get('patient') ?? undefined
  const rawMeasure = url.searchParams.get('measure') ?? undefined

  if (!rawPatientId)
    return ehrValidationError('patient query parameter is required.')
  if (!rawMeasure)
    return ehrValidationError('measure query parameter is required.')

  const validMeasureTypes: OutcomeMeasureType[] = ['phq-9', 'gad-7', 'oq-45']
  const measure = sanitizeSearchParam(rawMeasure, 16)
  if (!validMeasureTypes.includes(measure as OutcomeMeasureType))
    return ehrValidationError(
      `measure must be one of: ${validMeasureTypes.join(', ')}`,
    )

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
    const trend = await service.getTrend(
      patientId,
      measure as OutcomeMeasureType,
    )
    return ehrSuccess(trend)
  } catch (err) {
    return ehrValidationError(
      err instanceof Error ? err.message : 'Failed to retrieve trend data.',
    )
  }
})
