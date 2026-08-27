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
 * GET /api/ehr/v1/outcomes/config
 * Returns measure configurations for a patient (cadence, active, next due date).
 *
 * Query params:
 *   patient (required) — patient ID
 * @returns 200 with MeasureConfig[], or 403/400
 */
export const GET = withV1Contract('getMeasureConfigs', async (ctx, caller) => {
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
    const configs = await service.getMeasureConfigs(patientId)
    return ehrSuccess(configs)
  } catch (err) {
    return ehrValidationError(
      err instanceof Error
        ? err.message
        : 'Failed to retrieve measure configurations.',
    )
  }
})

/**
 * POST /api/ehr/v1/outcomes/config
 * Configures a measure for a patient (cadence, active status).
 *
 * Body: { patientId: string, measureType: 'phq-9'|'gad-7'|'oq-45', cadence: 'weekly'|'biweekly', active?: boolean }
 * @returns 200 with MeasureConfig, or 403/400
 */
export const POST = withV1Contract('configureMeasure', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId)
    return ehrValidationError('Tenant association required for EHR access.')

  const raw: unknown = await ctx.request.json().catch(() => null)
  if (!raw) return ehrValidationError('Request body must be valid JSON.')

  const { patientId, measureType, cadence, active } = raw as {
    patientId?: unknown
    measureType?: unknown
    cadence?: unknown
    active?: unknown
  }

  if (typeof patientId !== 'string' || patientId.trim() === '')
    return ehrValidationError(
      'patientId is required and must be a non-empty string.',
    )

  const validMeasureTypes: OutcomeMeasureType[] = ['phq-9', 'gad-7', 'oq-45']
  if (
    typeof measureType !== 'string' ||
    !validMeasureTypes.includes(measureType as OutcomeMeasureType)
  )
    return ehrValidationError(
      `measureType must be one of: ${validMeasureTypes.join(', ')}`,
    )

  if (
    typeof cadence !== 'string' ||
    (cadence !== 'weekly' && cadence !== 'biweekly')
  )
    return ehrValidationError('cadence must be "weekly" or "biweekly".')

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
    const config = await service.configureMeasure({
      patientId: sanitizedPatientId,
      measureType: measureType as OutcomeMeasureType,
      cadence: cadence,
      active: typeof active === 'boolean' ? active : undefined,
    })
    return ehrSuccess(config)
  } catch (err) {
    return ehrValidationError(
      err instanceof Error ? err.message : 'Failed to configure measure.',
    )
  }
})
