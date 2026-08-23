/** EHR Native — Encounters Collection API (F1.6) */
import { withV1Contract } from '@/lib/middleware/with-v1-contract'
import { resolveTenantId, requireEHRPermission, ehrCreated, ehrValidationError, ehrPaginated } from '@/lib/ehr-native/api'
import { EncounterRepository } from '@/lib/ehr-native/repositories'

/**
 * GET /api/ehr/v1/encounters
 * List encounters by patient, status, date range, or practitioner.
 * @returns 200 with encounter list, or 403/400
 */
export const GET = withV1Contract('listEncounters', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId) return ehrValidationError('Tenant association required for EHR access.')
  const perm = await requireEHRPermission(caller.user.role, 'read_encounter', caller.user.id, tenantId)
  if (!perm.allowed) return perm.response
  const repo = new EncounterRepository(perm.rlsContext)

  const url = new URL(ctx.request.url)
  const patientId = url.searchParams.get('patient') ?? undefined
  const status = url.searchParams.get('status') ?? undefined
  const practitioner = url.searchParams.get('practitioner') ?? undefined
  const startDate = url.searchParams.get('start') ?? undefined
  const endDate = url.searchParams.get('end') ?? undefined
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 1), 200)
  const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10) || 0, 0)

  let encounters
  if (patientId) {
    encounters = await repo.findByPatient(patientId, limit, offset)
  } else if (status) {
    encounters = await repo.findByStatus(status, limit, offset)
  } else if (practitioner) {
    encounters = await repo.findByPractitioner(practitioner, limit, offset)
  } else if (startDate && endDate) {
    encounters = await repo.findByDateRange(startDate, endDate, limit, offset)
  } else {
    return ehrValidationError('Provide at least one filter: patient, status, practitioner, or start+end.')
  }
  return ehrPaginated(encounters, { limit, offset, total: encounters.length })
})

/**
 * POST /api/ehr/v1/encounters
 * Create a new encounter from a FHIR Encounter resource.
 * @returns 201 with created encounter, or 403/400
 */
export const POST = withV1Contract('createEncounter', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId) return ehrValidationError('Tenant association required for EHR access.')
  const perm = await requireEHRPermission(caller.user.role, 'write_encounter', caller.user.id, tenantId)
  if (!perm.allowed) return perm.response
  const repo = new EncounterRepository(perm.rlsContext)

  const raw = await ctx.request.json().catch(() => null)
  if (!raw) return ehrValidationError('Request body must be valid JSON.')

  try {
    const encounter = await repo.create(raw)
    return ehrCreated(encounter)
  } catch (err) {
    return ehrValidationError(err instanceof Error ? err.message : 'Invalid encounter resource.')
  }
})
