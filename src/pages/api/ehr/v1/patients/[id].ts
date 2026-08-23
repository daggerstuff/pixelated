/** EHR Native — Patient Item API (F1.6) */
import { withV1Contract } from '@/lib/middleware/with-v1-contract'
import { resolveTenantId, requireEHRPermission, ehrSuccess, ehrValidationError, ehrNotFound } from '@/lib/ehr-native/api'
import { PatientService } from '@/lib/ehr-native/services'
import type { Patient } from '@/lib/ehr-native/types'

/**
 * GET /api/ehr/v1/patients/[id]
 * Get a patient by ID. Requires `read_patient` permission.
 * @param ctx - Astro route context
 * @param caller - Authenticated caller
 * @returns 200 with patient, or 403/404
 */
export const GET = withV1Contract('getPatient', async (ctx, caller) => {
  const patientId = ctx.params?.['id']
  if (!patientId) return ehrValidationError('Patient ID is required.')
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId) return ehrValidationError('Tenant association required for EHR access.')
  const perm = await requireEHRPermission(caller.user.role, 'read_patient', caller.user.id, tenantId, patientId)
  if (!perm.allowed) return perm.response
  const service = new PatientService(perm.rlsContext)

  const patient = await service.getPatient(patientId)
  if (!patient) return ehrNotFound('Patient', patientId)
  return ehrSuccess(patient)
})

/**
 * PATCH /api/ehr/v1/patients/[id]
 * Update a patient. Requires `write_patient` permission.
 * @param ctx - Astro route context
 * @param caller - Authenticated caller
 * @returns 200 with updated patient, or 403/404
 */
export const PATCH = withV1Contract('updatePatient', async (ctx, caller) => {
  const patientId = ctx.params?.['id']
  if (!patientId) return ehrValidationError('Patient ID is required.')
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId) return ehrValidationError('Tenant association required for EHR access.')
  const perm = await requireEHRPermission(caller.user.role, 'write_patient', caller.user.id, tenantId, patientId)
  if (!perm.allowed) return perm.response
  const service = new PatientService(perm.rlsContext)

  const raw = await ctx.request.json().catch(() => null)
  if (!raw || typeof raw !== 'object') return ehrValidationError('Request body must be a JSON object.')

  try {
    const patient = await service.updatePatient(patientId, { fhirResource: raw as Partial<Patient> })
    if (!patient) return ehrNotFound('Patient', patientId)
    return ehrSuccess(patient)
  } catch (err) {
    return ehrValidationError(err instanceof Error ? err.message : 'Invalid patient update data.')
  }
})

/**
 * DELETE /api/ehr/v1/patients/[id]
 * Deactivate a patient (soft delete). Requires `write_patient` permission.
 * @param ctx - Astro route context
 * @param caller - Authenticated caller
 * @returns 200 with deactivated patient, or 403/404
 */
export const DELETE = withV1Contract('deactivatePatient', async (ctx, caller) => {
  const patientId = ctx.params?.['id']
  if (!patientId) return ehrValidationError('Patient ID is required.')
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId) return ehrValidationError('Tenant association required for EHR access.')
  const perm = await requireEHRPermission(caller.user.role, 'write_patient', caller.user.id, tenantId, patientId)
  if (!perm.allowed) return perm.response
  const service = new PatientService(perm.rlsContext)

  const patient = await service.deactivatePatient(patientId)
  if (!patient) return ehrNotFound('Patient', patientId)
  return ehrSuccess(patient)
})
