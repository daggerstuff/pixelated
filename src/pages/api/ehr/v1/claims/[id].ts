/** EHR Native — Claim Item API (F1.6) */
import { withV1Contract } from '@/lib/middleware/with-v1-contract'
import { resolveTenantId, requireEHRPermission, ehrSuccess, ehrValidationError } from '@/lib/ehr-native/api'
import { claimsService, type ClaimStatus } from '@/lib/ehr-native/services'

/**
 * GET /api/ehr/v1/claims/[id]
 * Claims are stateless; the caller must provide the claim object in the body
 * for validation or summary. This endpoint validates a claim and returns its summary.
 * @returns 200 with claim summary, or 403/400
 */
export const GET = withV1Contract('getClaim', async (ctx, caller) => {
  const claimId = ctx.params?.['id']
  if (!claimId) return ehrValidationError('Claim ID is required.')
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId) return ehrValidationError('Tenant association required for EHR access.')
  const perm = await requireEHRPermission(caller.user.role, 'read_claim', caller.user.id, tenantId)
  if (!perm.allowed) return perm.response

  const url = new URL(ctx.request.url)
  const claimJson = url.searchParams.get('claim')
  if (!claimJson) {
    return ehrValidationError('Pass the claim object as a `claim` query parameter (URL-encoded JSON) for stateless validation.')
  }

  try {
    const claim = JSON.parse(decodeURIComponent(claimJson))
    const validation = claimsService.validateClaim(claim)
    const summary = claimsService.getSummary(claim)
    return ehrSuccess({ claimId, validation, summary })
  } catch (err) {
    return ehrValidationError(err instanceof Error ? err.message : 'Invalid claim JSON.')
  }
})

/**
 * PATCH /api/ehr/v1/claims/[id]
 * Update a claim status (stateless). Body: { claim, newStatus }
 * @returns 200 with updated claim, or 403/400
 */
export const PATCH = withV1Contract('updateClaimStatus', async (ctx, caller) => {
  const claimId = ctx.params?.['id']
  if (!claimId) return ehrValidationError('Claim ID is required.')
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId) return ehrValidationError('Tenant association required for EHR access.')
  const perm = await requireEHRPermission(caller.user.role, 'submit_claim', caller.user.id, tenantId)
  if (!perm.allowed) return perm.response

  const raw = await ctx.request.json().catch(() => null)
  if (!raw || typeof raw !== 'object') return ehrValidationError('Request body must be a JSON object.')

  const body = raw as Record<string, unknown>
  const claim = body['claim']
  const newStatus = body['newStatus'] as ClaimStatus | undefined
  if (!claim || !newStatus) return ehrValidationError('Body must include `claim` and `newStatus`.')

  try {
    const updated = claimsService.updateStatus(claim as never, newStatus)
    return ehrSuccess(updated)
  } catch (err) {
    return ehrValidationError(err instanceof Error ? err.message : 'Claim status update failed.')
  }
})
