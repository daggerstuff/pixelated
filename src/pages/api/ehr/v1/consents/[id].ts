/** EHR Native — Consent Item API (F1.6) */
import { withV1Contract } from '@/lib/middleware/with-v1-contract'
import { resolveTenantId, requireEHRPermission, ehrSuccess, ehrValidationError } from '@/lib/ehr-native/api'
import { consentService } from '@/lib/ehr-native/consent'

/**
 * GET /api/ehr/v1/consents/[id]
 * Verify consent for a specific patient (id = patientId).
 * Query params: minimumLevel (default: general), [stateCode], [treatmentCategory]
 * @returns 200 with consent verification, or 403/400
 */
export const GET = withV1Contract('getConsent', async (ctx, caller) => {
  const patientId = ctx.params?.['id']
  if (!patientId) return ehrValidationError('Patient ID is required.')
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId) return ehrValidationError('Tenant association required for EHR access.')
  const perm = await requireEHRPermission(caller.user.role, 'manage_consent', caller.user.id, tenantId, patientId)
  if (!perm.allowed) return perm.response

  const url = new URL(ctx.request.url)
  const minimumLevel = url.searchParams.get('minimumLevel') ?? 'general'
  const stateCode = url.searchParams.get('stateCode') ?? undefined
  const treatmentCategory = url.searchParams.get('treatmentCategory') ?? undefined

  const result = await consentService.verifyConsent(patientId, tenantId, minimumLevel as never, stateCode, treatmentCategory)
  return ehrSuccess(result)
})
