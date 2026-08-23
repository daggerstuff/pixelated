/** EHR Native — Claims Collection API (F1.6) */
import { withV1Contract } from '@/lib/middleware/with-v1-contract'
import { resolveTenantId, requireEHRPermission, ehrCreated, ehrValidationError, ehrSuccess } from '@/lib/ehr-native/api'
import { claimsService, type CreateClaimInput } from '@/lib/ehr-native/services'

/**
 * GET /api/ehr/v1/claims
 * Claims are stateless; this returns available claim statuses and use types.
 * @returns 200 with reference data, or 403
 */
export const GET = withV1Contract('listClaims', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId) return ehrValidationError('Tenant association required for EHR access.')
  const perm = await requireEHRPermission(caller.user.role, 'read_claim', caller.user.id, tenantId)
  if (!perm.allowed) return perm.response

  return ehrSuccess({
    statuses: ['draft', 'ready', 'submitted', 'accepted', 'rejected', 'paid', 'denied'],
    useTypes: ['claim', 'preauthorization', 'estimate'],
  })
})

/**
 * POST /api/ehr/v1/claims
 * Create a new claim for clearinghouse submission.
 * @returns 201 with created claim, or 403/400
 */
export const POST = withV1Contract('createClaim', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId) return ehrValidationError('Tenant association required for EHR access.')
  const perm = await requireEHRPermission(caller.user.role, 'submit_claim', caller.user.id, tenantId)
  if (!perm.allowed) return perm.response

  const raw = await ctx.request.json().catch(() => null)
  if (!raw) return ehrValidationError('Request body must be valid JSON.')

  try {
    const claim = claimsService.createClaim(raw as CreateClaimInput)
    return ehrCreated(claim)
  } catch (err) {
    return ehrValidationError(err instanceof Error ? err.message : 'Invalid claim input.')
  }
})
