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
import { EncounterRepository } from '@/lib/ehr-native/repositories'
/** EHR Native — Encounters Collection API (F1.6) */
import { withV1Contract } from '@/lib/middleware/with-v1-contract'

/**
 * GET /api/ehr/v1/encounters
 * List encounters by patient, status, date range, or practitioner.
 * @returns 200 with encounter list, or 403/400
 */
export const GET = withV1Contract('listEncounters', async (ctx, caller) => {
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

  const url = new URL(ctx.request.url)
  const rawPatientId = url.searchParams.get('patient') ?? undefined
  const rawStatus = url.searchParams.get('status') ?? undefined
  const rawPractitioner = url.searchParams.get('practitioner') ?? undefined
  const rawStartDate = url.searchParams.get('start') ?? undefined
  const rawEndDate = url.searchParams.get('end') ?? undefined
  const limit = sanitizeLimitParam(
    parseInt(url.searchParams.get('limit') ?? '50', 10),
  )
  const offset = sanitizeOffsetParam(
    parseInt(url.searchParams.get('offset') ?? '0', 10),
  )

  let encounters
  try {
    if (rawPatientId) {
      const patientId = sanitizeFhirId(rawPatientId, 'patient ID')
      encounters = await repo.findByPatient(patientId, limit, offset)
    } else if (rawStatus) {
      const status = sanitizeSearchParam(rawStatus, 64)
      encounters = await repo.findByStatus(status, limit, offset)
    } else if (rawPractitioner) {
      const practitioner = sanitizeFhirId(rawPractitioner, 'practitioner ID')
      encounters = await repo.findByPractitioner(practitioner, limit, offset)
    } else if (rawStartDate && rawEndDate) {
      const startDate = sanitizeIsoTimestamp(rawStartDate, 'start date')
      const endDate = sanitizeIsoTimestamp(rawEndDate, 'end date')
      encounters = await repo.findByDateRange(startDate, endDate, limit, offset)
    } else {
      return ehrValidationError(
        'Provide at least one filter: patient, status, practitioner, or start+end.',
      )
    }
  } catch (err) {
    return ehrValidationError(
      err instanceof Error ? err.message : 'Invalid search parameters.',
    )
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

  try {
    const encounter = await repo.create(raw)
    return ehrCreated(encounter)
  } catch (err) {
    return ehrValidationError(
      err instanceof Error ? err.message : 'Invalid encounter resource.',
    )
  }
})
