import {
  resolveTenantId,
  requireEHRPermission,
  ehrSuccess,
  ehrValidationError,
  ehrNotFound,
} from '@/lib/ehr-native/api'
import { EncounterRepository } from '@/lib/ehr-native/repositories'
/** EHR Native — Encounter Item API (F1.6) */
import { withV1Contract } from '@/lib/middleware/with-v1-contract'

/**
 * GET /api/ehr/v1/encounters/[id]
 * Get an encounter by ID.
 * @returns 200 with encounter, or 403/404
 */
export const GET = withV1Contract('getEncounter', async (ctx, caller) => {
  const encounterId = ctx.params?.['id']
  if (!encounterId) return ehrValidationError('Encounter ID is required.')
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId)
    return ehrValidationError('Tenant association required for EHR access.')
  const perm = await requireEHRPermission(
    caller.user.role,
    'read_encounter',
    caller.user.id,
    tenantId,
  )
  if (!perm.allowed) return perm.response
  const repo = new EncounterRepository(perm.rlsContext)

  const encounter = await repo.findById(encounterId)
  if (!encounter) return ehrNotFound('Encounter', encounterId)
  return ehrSuccess(encounter)
})

/**
 * PATCH /api/ehr/v1/encounters/[id]
 * Update an encounter with partial FHIR Encounter fields.
 * @returns 200 with updated encounter, or 403/404
 */
export const PATCH = withV1Contract('updateEncounter', async (ctx, caller) => {
  const encounterId = ctx.params?.['id']
  if (!encounterId) return ehrValidationError('Encounter ID is required.')
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId)
    return ehrValidationError('Tenant association required for EHR access.')
  const perm = await requireEHRPermission(
    caller.user.role,
    'write_encounter',
    caller.user.id,
    tenantId,
  )
  if (!perm.allowed) return perm.response
  const repo = new EncounterRepository(perm.rlsContext)

  const raw = await ctx.request.json().catch(() => null)
  if (!raw) return ehrValidationError('Request body must be valid JSON.')

  const encounter = await repo.update(encounterId, raw)
  if (!encounter) return ehrNotFound('Encounter', encounterId)
  return ehrSuccess(encounter)
})
