/** EHR Native — Observations Collection API (F1.6) */
import { withV1Contract } from '@/lib/middleware/with-v1-contract'
import { resolveTenantId, requireEHRPermission, ehrCreated, ehrValidationError, ehrPaginated } from '@/lib/ehr-native/api'
import { ObservationRepository } from '@/lib/ehr-native/repositories'

/**
 * GET /api/ehr/v1/observations
 * List observations by patient, encounter, code (LOINC), status, or date range.
 * @returns 200 with observation list, or 403/400
 */
export const GET = withV1Contract('listObservations', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId) return ehrValidationError('Tenant association required for EHR access.')
  const perm = await requireEHRPermission(caller.user.role, 'read_observation', caller.user.id, tenantId)
  if (!perm.allowed) return perm.response
  const repo = new ObservationRepository(perm.rlsContext)

  const url = new URL(ctx.request.url)
  const patientId = url.searchParams.get('patient') ?? undefined
  const encounterId = url.searchParams.get('encounter') ?? undefined
  const code = url.searchParams.get('code') ?? undefined
  const status = url.searchParams.get('status') ?? undefined
  const startDate = url.searchParams.get('start') ?? undefined
  const endDate = url.searchParams.get('end') ?? undefined
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 1), 200)
  const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10) || 0, 0)

  let observations
  if (encounterId) {
    observations = await repo.findByEncounter(encounterId, limit, offset)
  } else if (patientId && startDate && endDate) {
    observations = await repo.findByPatientAndDateRange(patientId, startDate, endDate, limit, offset)
  } else if (patientId) {
    observations = await repo.findByPatient(patientId, limit, offset)
  } else if (code) {
    observations = await repo.findByCode(code, limit, offset)
  } else if (status) {
    observations = await repo.findByStatus(status, limit, offset)
  } else {
    return ehrValidationError('Provide at least one filter: patient, encounter, code, status, or patient+start+end.')
  }
  return ehrPaginated(observations, { limit, offset, total: observations.length })
})

/**
 * POST /api/ehr/v1/observations
 * Create a new observation (e.g. PHQ-9, GAD-7 scores).
 * @returns 201 with created observation, or 403/400
 */
export const POST = withV1Contract('createObservation', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId) return ehrValidationError('Tenant association required for EHR access.')
  const perm = await requireEHRPermission(caller.user.role, 'write_observation', caller.user.id, tenantId)
  if (!perm.allowed) return perm.response
  const repo = new ObservationRepository(perm.rlsContext)

  const raw = await ctx.request.json().catch(() => null)
  if (!raw) return ehrValidationError('Request body must be valid JSON.')

  try {
    const observation = await repo.create(raw)
    return ehrCreated(observation)
  } catch (err) {
    return ehrValidationError(err instanceof Error ? err.message : 'Invalid observation resource.')
  }
})
