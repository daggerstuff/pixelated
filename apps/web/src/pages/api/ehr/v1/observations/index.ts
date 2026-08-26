import {
  resolveTenantId,
  requireEHRPermission,
  ehrCreated,
  ehrValidationError,
  ehrPaginated,
  sanitizeFhirId,
  sanitizeSearchParam,
  sanitizeLimitParam,
  sanitizeOffsetParam,
  sanitizeIsoTimestamp,
} from '@/lib/ehr-native/api'
import { ObservationRepository } from '@/lib/ehr-native/repositories'
/** EHR Native — Observations Collection API (F1.6) */
import { withV1Contract } from '@/lib/middleware/with-v1-contract'

/**
 * GET /api/ehr/v1/observations
 * List observations by patient, encounter, code (LOINC), status, or date range.
 * @returns 200 with observation list, or 403/400
 */
export const GET = withV1Contract('listObservations', async (ctx, caller) => {
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
  const repo = new ObservationRepository(perm.rlsContext)

  const url = new URL(ctx.request.url)
  const rawEncounterId = url.searchParams.get('encounter') ?? undefined
  const rawPatientId = url.searchParams.get('patient') ?? undefined
  const rawCode = url.searchParams.get('code') ?? undefined
  const rawStatus = url.searchParams.get('status') ?? undefined
  const rawStartDate = url.searchParams.get('start') ?? undefined
  const rawEndDate = url.searchParams.get('end') ?? undefined
  const limit = sanitizeLimitParam(
    parseInt(url.searchParams.get('limit') ?? '50', 10),
  )
  const offset = sanitizeOffsetParam(
    parseInt(url.searchParams.get('offset') ?? '0', 10),
  )

  let observations
  try {
    if (rawEncounterId) {
      const encounterId = sanitizeFhirId(rawEncounterId, 'encounter ID')
      observations = await repo.findByEncounter(encounterId, limit, offset)
    } else if (rawPatientId && rawStartDate && rawEndDate) {
      const patientId = sanitizeFhirId(rawPatientId, 'patient ID')
      const startDate = sanitizeIsoTimestamp(rawStartDate, 'start date')
      const endDate = sanitizeIsoTimestamp(rawEndDate, 'end date')
      observations = await repo.findByPatientAndDateRange(
        patientId,
        startDate,
        endDate,
        limit,
        offset,
      )
    } else if (rawPatientId) {
      const patientId = sanitizeFhirId(rawPatientId, 'patient ID')
      observations = await repo.findByPatient(patientId, limit, offset)
    } else if (rawCode) {
      const code = sanitizeSearchParam(rawCode, 32)
      observations = await repo.findByCode(code, limit, offset)
    } else if (rawStatus) {
      const status = sanitizeSearchParam(rawStatus, 64)
      observations = await repo.findByStatus(status, limit, offset)
    } else {
      return ehrValidationError(
        'Provide at least one filter: patient, encounter, code, status, or patient+start+end.',
      )
    }
  } catch (err) {
    return ehrValidationError(
      err instanceof Error ? err.message : 'Invalid search parameters.',
    )
  }
  return ehrPaginated(observations, {
    limit,
    offset,
    total: observations.length,
  })
})

/**
 * POST /api/ehr/v1/observations
 * Create a new observation (e.g. PHQ-9, GAD-7 scores).
 * @returns 201 with created observation, or 403/400
 */
export const POST = withV1Contract('createObservation', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId)
    return ehrValidationError('Tenant association required for EHR access.')
  const perm = await requireEHRPermission(
    caller.user.role,
    'write_observation',
    caller.user.id,
    tenantId,
  )
  if (!perm.allowed) return perm.response
  const repo = new ObservationRepository(perm.rlsContext)

  const raw = await ctx.request.json().catch(() => null)
  if (!raw) return ehrValidationError('Request body must be valid JSON.')

  try {
    const observation = await repo.create(raw)
    return ehrCreated(observation)
  } catch (err) {
    return ehrValidationError(
      err instanceof Error ? err.message : 'Invalid observation resource.',
    )
  }
})
