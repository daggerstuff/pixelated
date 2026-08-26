/**
 * EHR AI Risk Stratification API Endpoint (G2.2 — PIX-4427)
 *
 * Three actions:
 * - POST action=submit: Intercept a risk stratification AI response → mark pending_clinician_review.
 *   BAA compliance check runs first; blocks if BAA not confirmed.
 * - POST action=approve: Clinician approves a pending risk score for chart entry.
 * - POST action=reject: Clinician rejects a pending risk score (requires reason).
 * - GET: Retrieve a risk review by ID or list reviews for a patient.
 */

import {
  resolveTenantId,
  requireEHRPermission,
  ehrSuccess,
  ehrValidationError,
  ehrNotFound,
  sanitizeFhirId,
} from '@/lib/ehr-native/api'
import { withV1Contract } from '@/lib/middleware/with-v1-contract'
import { z } from 'zod'
import {
  interceptRiskScore,
  reviewRiskScore,
  getReview,
  getReviewsForPatient,
  getAuditTrail,
  checkBAACompliance,
} from '@/lib/ehr-native/gates/risk-stratification-gate'
import type { RiskAISystemSource } from '@/lib/ehr-native/gates/types'

const submitSchema = z.object({
  action: z.literal('submit'),
  patientId: z.string().min(1),
  riskScore: z.number(),
  riskLevel: z.string().min(1),
  aiSystemSource: z.enum(['nim-hetzner', 'nvidia', 'local-fallback']),
})

const approveSchema = z.object({
  action: z.literal('approve'),
  reviewId: z.string().min(1),
})

const rejectSchema = z.object({
  action: z.literal('reject'),
  reviewId: z.string().min(1),
  rejectionReason: z.string().min(1),
})

const postSchema = z.discriminatedUnion('action', [
  submitSchema,
  approveSchema,
  rejectSchema,
])

export const POST = withV1Contract('riskStratificationGate', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId) return ehrValidationError('Tenant association required for EHR access.')

  const raw = await ctx.request.json().catch(() => null)
  if (!raw || typeof raw !== 'object') {
    return ehrValidationError('Request body must be a JSON object.')
  }

  const parsed = postSchema.safeParse(raw)
  if (!parsed.success) {
    return ehrValidationError(
      `Invalid request body: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
    )
  }

  const body = parsed.data

  if (body.action === 'submit') {
    // Submit: intercept risk stratification AI response
    // Requires write_patient (the risk score will be written to chart after approval)
    const perm = await requireEHRPermission(
      caller.user.role,
      'write_patient',
      caller.user.id,
      tenantId,
      body.patientId,
    )
    if (!perm.allowed) return perm.response

    // Pre-check BAA compliance so we can return a clear error
    const baaCheck = checkBAACompliance(body.aiSystemSource as RiskAISystemSource)
    if (!baaCheck.compliant) {
      return ehrValidationError(
        `${baaCheck.reason ?? 'BAA compliance check failed.'} Risk stratification blocked.`,
      )
    }

    const result = interceptRiskScore({
      patientId: body.patientId,
      tenantId,
      riskScore: body.riskScore,
      riskLevel: body.riskLevel,
      aiSystemSource: body.aiSystemSource as RiskAISystemSource,
      submittedByUserId: caller.user.id,
    })

    if (!result.ok || !result.data) {
      return ehrValidationError(result.error ?? 'Failed to intercept risk score.')
    }

    return ehrSuccess({
      reviewId: result.data.id,
      state: result.data.state,
      patientId: result.data.patientId,
      riskScore: result.data.riskScore,
      riskLevel: result.data.riskLevel,
      aiSystemSource: result.data.aiSystemSource,
      submittedAt: result.data.submittedAt,
    })
  }

  if (body.action === 'approve' || body.action === 'reject') {
    // Approve/Reject: clinician review of pending risk score
    // Must verify the review exists first
    const review = getReview(body.reviewId)
    if (!review) {
      return ehrNotFound('risk-stratification-review', body.reviewId)
    }

    // RBAC: clinician must have write_patient permission for the patient
    const perm = await requireEHRPermission(
      caller.user.role,
      'write_patient',
      caller.user.id,
      tenantId,
      review.patientId,
    )
    if (!perm.allowed) return perm.response

    const result = await reviewRiskScore({
      reviewId: body.reviewId,
      clinicianId: caller.user.id,
      clinicianRole: caller.user.role,
      approved: body.action === 'approve',
      rejectionReason: body.action === 'reject' ? body.rejectionReason : undefined,
    })

    if (!result.ok || !result.data) {
      return ehrValidationError(result.error ?? 'Failed to review risk score.')
    }

    return ehrSuccess({
      reviewId: result.data.id,
      state: result.data.state,
      reviewedAt: result.data.reviewedAt,
      reviewingClinicianId: result.data.reviewingClinicianId,
      reviewingClinicianRole: result.data.reviewingClinicianRole,
      rejectionReason: result.data.rejectionReason,
      auditTrail: getAuditTrail(body.reviewId),
    })
  }

  // Should not reach here due to Zod discriminated union
  return ehrValidationError('Unknown action.')
})

export const GET = withV1Contract('riskStratificationGateQuery', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId) return ehrValidationError('Tenant association required for EHR access.')

  const url = new URL(ctx.request.url)
  const reviewIdParam = url.searchParams.get('reviewId')
  const patientIdParam = url.searchParams.get('patientId')

  // Query by reviewId
  if (reviewIdParam) {
    const reviewId = sanitizeFhirId(reviewIdParam, 'reviewId')
    if (!reviewId) return ehrValidationError('Invalid reviewId.')

    const perm = await requireEHRPermission(
      caller.user.role,
      'read_patient',
      caller.user.id,
      tenantId,
    )
    if (!perm.allowed) return perm.response

    const review = getReview(reviewId)
    if (!review) return ehrNotFound('risk-stratification-review', reviewId)

    return ehrSuccess({
      ...review,
      auditTrail: getAuditTrail(reviewId),
    })
  }

  // Query by patientId — list all reviews for a patient
  if (patientIdParam) {
    const patientId = sanitizeFhirId(patientIdParam, 'patientId')
    if (!patientId) return ehrValidationError('Invalid patientId.')

    const perm = await requireEHRPermission(
      caller.user.role,
      'read_patient',
      caller.user.id,
      tenantId,
      patientId,
    )
    if (!perm.allowed) return perm.response

    const reviews = getReviewsForPatient(patientId)
    return ehrSuccess({ reviews, count: reviews.length })
  }

  return ehrValidationError('Provide either reviewId or patientId as a query parameter.')
})
