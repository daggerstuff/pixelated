/** EHR Native — Observation Item API (F1.6) */
import { withV1Contract } from '@/lib/middleware/with-v1-contract'
import { resolveTenantId, requireEHRPermission, ehrSuccess, ehrValidationError, ehrNotFound } from '@/lib/ehr-native/api'
import { ObservationRepository } from '@/lib/ehr-native/repositories'

/**
 * GET /api/ehr/v1/observations/[id]
 * Get an observation by ID.
 * @returns 200 with observation, or 403/404
 */
export const GET = withV1Contract('getObservation', async (ctx, caller) => {
  const observationId = ctx.params?.['id']
  if (!observationId) return ehrValidationError('Observation ID is required.')
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId) return ehrValidationError('Tenant association required for EHR access.')
  const perm = await requireEHRPermission(caller.user.role, 'read_observation', caller.user.id, tenantId)
  if (!perm.allowed) return perm.response
  const repo = new ObservationRepository(perm.rlsContext)

  const observation = await repo.findById(observationId)
  if (!observation) return ehrNotFound('Observation', observationId)
  return ehrSuccess(observation)
})

/**
 * PATCH /api/ehr/v1/observations/[id]
 * Update an observation with partial fields.
 * @returns 200 with updated observation, or 403/404
 */
export const PATCH = withV1Contract('updateObservation', async (ctx, caller) => {
  const observationId = ctx.params?.['id']
  if (!observationId) return ehrValidationError('Observation ID is required.')
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId) return ehrValidationError('Tenant association required for EHR access.')
  const perm = await requireEHRPermission(caller.user.role, 'write_observation', caller.user.id, tenantId)
  if (!perm.allowed) return perm.response
  const repo = new ObservationRepository(perm.rlsContext)

  const raw = await ctx.request.json().catch(() => null)
  if (!raw) return ehrValidationError('Request body must be valid JSON.')

  const observation = await repo.update(observationId, raw)
  if (!observation) return ehrNotFound('Observation', observationId)
  return ehrSuccess(observation)
})
