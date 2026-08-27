import {
  resolveTenantId,
  requireEHRPermission,
  ehrCreated,
  ehrValidationError,
  ehrSuccess,
  sanitizeFhirId,
} from '@/lib/ehr-native/api'
import { OutcomesService } from '@/lib/ehr-native/services'
import type { OutcomeMeasureType } from '@/lib/ehr-native/types'
import { withV1Contract } from '@/lib/middleware/with-v1-contract'

/**
 * GET /api/ehr/v1/outcomes
 * Returns available outcome measures (PHQ-9, GAD-7, OQ-45) with metadata.
 * @returns 200 with measure list, or 403/400
 */
export const GET = withV1Contract('listOutcomeMeasures', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId)
    return ehrValidationError('Tenant association required for EHR access.')
  const perm = await requireEHRPermission(
    caller.user.role,
    'read_observation',
    caller.user.id,
    tenantId,
  )
  if (!perm.allowed) return perm.response

  const service = new OutcomesService(perm.rlsContext)
  const measures = service.getAvailableMeasures()
  return ehrSuccess(measures)
})

/**
 * POST /api/ehr/v1/outcomes
 * Submits a completed outcome measure, scores it, detects significant change,
 * and stores the QuestionnaireResponse + scored Observation.
 *
 * Body: { patientId: string, measureType: 'phq-9'|'gad-7'|'oq-45', responses: Record<string, number>, authored?: string }
 * @returns 201 with { response, observation, score }, or 403/400
 */
export const POST = withV1Contract('submitOutcomeMeasure', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId)
    return ehrValidationError('Tenant association required for EHR access.')

  const raw = await ctx.request.json().catch(() => null)
  if (!raw) return ehrValidationError('Request body must be valid JSON.')

  const { patientId, measureType, responses, authored } = raw as {
    patientId?: unknown
    measureType?: unknown
    responses?: unknown
    authored?: unknown
  }

  if (typeof patientId !== 'string' || patientId.trim() === '')
    return ehrValidationError('patientId is required and must be a non-empty string.')

  const validMeasureTypes: OutcomeMeasureType[] = ['phq-9', 'gad-7', 'oq-45']
  if (typeof measureType !== 'string' || !validMeasureTypes.includes(measureType as OutcomeMeasureType))
    return ehrValidationError(`measureType must be one of: ${validMeasureTypes.join(', ')}`)

  if (typeof responses !== 'object' || responses === null || Array.isArray(responses))
    return ehrValidationError('responses must be an object mapping linkId to numeric answer value.')

  const sanitizedPatientId = sanitizeFhirId(patientId, 'patient ID')

  const perm = await requireEHRPermission(
    caller.user.role,
    'write_observation',
    caller.user.id,
    tenantId,
    sanitizedPatientId,
  )
  if (!perm.allowed) return perm.response

  const service = new OutcomesService(perm.rlsContext)

  try {
    const result = await service.submitMeasure({
      patientId: sanitizedPatientId,
      measureType: measureType as OutcomeMeasureType,
      responses: responses as Record<string, number>,
      authored: typeof authored === 'string' ? authored : undefined,
    })
    return ehrCreated(result)
  } catch (err) {
    return ehrValidationError(
      err instanceof Error ? err.message : 'Failed to submit outcome measure.',
    )
  }
})
