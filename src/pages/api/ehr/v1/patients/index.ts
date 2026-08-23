/** EHR Native — Patients Collection API (F1.6) */
import { withV1Contract } from '@/lib/middleware/with-v1-contract'
import { resolveTenantId, requireEHRPermission, ehrSuccess, ehrCreated, ehrValidationError, ehrPaginated } from '@/lib/ehr-native/api'
import { PatientService } from '@/lib/ehr-native/services'
import { z } from 'zod'

/**
 * GET /api/ehr/v1/patients
 * List or search patients. Requires `read_patient` permission.
 * @param ctx - Astro route context
 * @param caller - Authenticated caller
 * @returns 200 with patient list + pagination, or 403/400
 */
export const GET = withV1Contract('listPatients', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId) return ehrValidationError('Tenant association required for EHR access.')
  const perm = await requireEHRPermission(caller.user.role, 'read_patient', caller.user.id, tenantId)
  if (!perm.allowed) return perm.response
  const service = new PatientService(perm.rlsContext)

  const url = new URL(ctx.request.url)
  const searchQuery = url.searchParams.get('q') ?? undefined
  const active = url.searchParams.get('active')
  const limit = url.searchParams.get('limit')
  const offset = url.searchParams.get('offset')

  const limitNum = limit ? Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200) : 50
  const offsetNum = offset ? Math.max(parseInt(offset, 10) || 0, 0) : 0

  const activeOnly = active !== 'false'
  const patients = await service.searchPatients({ nameQuery: searchQuery, activeOnly, limit: limitNum, offset: offsetNum })
  return ehrPaginated(patients, { limit: limitNum, offset: offsetNum, total: patients.length })
})

const createPatientSchema = z.object({
  identifier: z.array(z.object({
    system: z.string(),
    value: z.string(),
  })).optional(),
  name: z.array(z.object({
    family: z.string(),
    given: z.array(z.string()).optional(),
    use: z.string().optional(),
  })),
  birthDate: z.string().optional(),
  gender: z.string().optional(),
  telecom: z.array(z.object({
    system: z.string().optional(),
    value: z.string().optional(),
    use: z.string().optional(),
  })).optional(),
  address: z.array(z.object({
    line: z.array(z.string()).optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
  })).optional(),
  active: z.boolean().optional(),
})

/**
 * POST /api/ehr/v1/patients
 * Create a new patient. Requires `write_patient` permission.
 * @param ctx - Astro route context
 * @param caller - Authenticated caller
 * @returns 201 with created patient, or 403/400
 */
export const POST = withV1Contract('createPatient', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId) return ehrValidationError('Tenant association required for EHR access.')
  const perm = await requireEHRPermission(caller.user.role, 'write_patient', caller.user.id, tenantId)
  if (!perm.allowed) return perm.response
  const service = new PatientService(perm.rlsContext)

  const raw = await ctx.request.json()
  const parsed = createPatientSchema.safeParse(raw)
  if (!parsed.success) {
    return ehrValidationError(parsed.error.message)
  }

  const patient = await service.createPatient({ fhirResource: parsed.data })
  return ehrCreated(patient)
})
