import {
  resolveTenantId,
  requireEHRPermission,
  ehrSuccess,
  ehrValidationError,
} from '@/lib/ehr-native/api'
import { consentService } from '@/lib/ehr-native/consent'
/** EHR Native — Consents Collection API (F1.6) */
import { withV1Contract } from '@/lib/middleware/with-v1-contract'

/**
 * GET /api/ehr/v1/consents
 * Verify consent for a patient. Query params: patientId, minimumLevel, [stateCode], [treatmentCategory]
 * @returns 200 with consent verification result, or 403/400
 */
export const GET = withV1Contract('verifyConsent', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId)
    return ehrValidationError('Tenant association required for EHR access.')
  const perm = await requireEHRPermission(
    caller.user.role,
    'manage_consent',
    caller.user.id,
    tenantId,
  )
  if (!perm.allowed) return perm.response

  const url = new URL(ctx.request.url)
  const patientId = url.searchParams.get('patientId')
  const minimumLevel = url.searchParams.get('minimumLevel') ?? 'general'
  const stateCode = url.searchParams.get('stateCode') ?? undefined
  const treatmentCategory =
    url.searchParams.get('treatmentCategory') ?? undefined
  if (!patientId)
    return ehrValidationError('patientId query parameter is required.')

  const result = await consentService.verifyConsent(
    patientId,
    tenantId,
    minimumLevel as never,
    stateCode,
    treatmentCategory,
  )
  return ehrSuccess(result)
})

/**
 * POST /api/ehr/v1/consents
 * Verify consent for a specific patient and minimum consent level.
 * Body: { patientId, minimumLevel, [stateCode], [treatmentCategory] }
 * @returns 200 with verification result, or 403/400
 */
export const POST = withV1Contract('checkConsent', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId)
    return ehrValidationError('Tenant association required for EHR access.')
  const perm = await requireEHRPermission(
    caller.user.role,
    'manage_consent',
    caller.user.id,
    tenantId,
  )
  if (!perm.allowed) return perm.response

  const raw = await ctx.request.json().catch(() => null)
  if (!raw || typeof raw !== 'object')
    return ehrValidationError('Request body must be a JSON object.')

  const body = raw as Record<string, unknown>
  const patientId = body['patientId'] as string | undefined
  const minimumLevel = body['minimumLevel'] as string | undefined
  const stateCode = body['stateCode'] as string | undefined
  const treatmentCategory = body['treatmentCategory'] as string | undefined
  if (!patientId || !minimumLevel)
    return ehrValidationError('patientId and minimumLevel are required.')

  const result = await consentService.verifyConsent(
    patientId,
    tenantId,
    minimumLevel as never,
    stateCode,
    treatmentCategory,
  )
  return ehrSuccess(result)
})
