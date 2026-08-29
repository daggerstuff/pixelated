/**
 * Risk Stratification Gate Service (G2.2 — PIX-4427)
 *
 * Compliance gate ensuring risk stratification output (from F2.2 service PIX-4411)
 * is reviewed by a clinician before entering patient chart.
 *
 * Responsibilities:
 * 1. BAA compliance check — verifies BAA executed with AI provider before processing risk data.
 *    Uses G2.3 (PIX-4428) BAA environment variable infrastructure.
 * 2. Intercept risk stratification AI responses → mark as pending_clinician_review.
 * 3. Enforce clinician sign-off — risk scores cannot be written to patient chart without approval.
 * 4. Record audit trail: patient_id, risk_score, AI system source, reviewing clinician, approved_at.
 */

import { logAuditEvent } from '@/lib/audit/log'
import { checkPermission } from '@/lib/ehr-native/auth/ehr-rbac'
import type {
  ClinicalRole,
  EHRPermissionCheckResult,
} from '@/lib/ehr-native/auth/types'

import type {
  BAAComplianceCheck,
  InterceptRiskScoreParams,
  RiskAISystemSource,
  RiskGateAuditEntry,
  RiskGateResult,
  RiskStratificationReview,
  ReviewRiskScoreParams,
} from './types'

export type {
  RiskAISystemSource,
  RiskGateAuditEntry,
  RiskGateResult,
  RiskStratificationReview,
}

// ---------------------------------------------------------------------------
// In-memory store (production would use a persistent store with RLS)
// ---------------------------------------------------------------------------

const reviewStore = new Map<string, RiskStratificationReview>()
const auditStore = new Map<string, RiskGateAuditEntry[]>()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let reviewCounter = 0
let auditCounter = 0

function generateReviewId(): string {
  reviewCounter += 1
  return `risk-review-${Date.now()}-${reviewCounter}`
}

function generateAuditId(): string {
  auditCounter += 1
  return `risk-audit-${Date.now()}-${auditCounter}`
}

function nowIso(): string {
  return new Date().toISOString()
}

// ---------------------------------------------------------------------------
// BAA Compliance Check
// ---------------------------------------------------------------------------

/**
 * Maps an AI system source to the BAA environment variable that must be confirmed.
 * Returns the env var name or null if the source doesn't require a BAA.
 */
function baaEnvVarForSource(source: RiskAISystemSource): string | null {
  switch (source) {
    case 'nim-hetzner':
      return 'BAA_NIM_HETZNER_CONFIRMED'
    case 'nvidia':
      return 'BAA_NVIDIA_CONFIRMED'
    case 'local-fallback':
      // Local fallback doesn't involve an external AI provider — no BAA needed
      return null
  }
}

/**
 * Verifies BAA compliance for the given AI system source.
 *
 * Checks that the relevant BAA_*_CONFIRMED environment variable is set to 'true'
 * before processing risk data from an external AI provider.
 *
 * Per G2.3 (PIX-4428), the gate fails closed: missing/false env var → blocked.
 */
export function checkBAACompliance(
  source: RiskAISystemSource,
): BAAComplianceCheck {
  const envVar = baaEnvVarForSource(source)

  if (envVar === null) {
    // Local fallback — no BAA required
    return {
      compliant: true,
      provider: source,
      reason: null,
      verifiedEnvVar: null,
    }
  }

  const rawValue =
    (import.meta.env?.[envVar] as string | undefined) ??
    (process.env?.[envVar] as string | undefined) ??
    ''

  if (rawValue.toLowerCase() === 'true') {
    return {
      compliant: true,
      provider: source,
      reason: null,
      verifiedEnvVar: envVar,
    }
  }

  return {
    compliant: false,
    provider: source,
    reason: `BAA not confirmed for ${source}. Environment variable ${envVar} must be set to 'true'.`,
    verifiedEnvVar: envVar,
  }
}

// ---------------------------------------------------------------------------
// Audit Trail
// ---------------------------------------------------------------------------

function recordAudit(
  reviewId: string,
  patientId: string,
  riskScore: number,
  aiSystemSource: RiskAISystemSource,
  action: RiskGateAuditEntry['action'],
  userId: string,
  metadata: Record<string, unknown> = {},
): RiskGateAuditEntry {
  const entry: RiskGateAuditEntry = {
    id: generateAuditId(),
    reviewId,
    patientId,
    riskScore,
    aiSystemSource,
    action,
    userId,
    timestamp: nowIso(),
    metadata,
  }

  const list = auditStore.get(reviewId) ?? []
  list.push(entry)
  auditStore.set(reviewId, list)

  // Also push to the centralized audit system (fire-and-forget)
  void logAuditEvent(
    userId,
    `risk_gate_${action}` as never,
    reviewId,
    'risk_stratification_review',
    {
      patientId,
      riskScore,
      aiSystemSource,
      action,
      ...metadata,
    },
  ).catch(() => {
    // Audit logging is best-effort; don't block the gate on audit failures
  })

  return entry
}

/**
 * Returns the full audit trail for a risk stratification review.
 */
export function getAuditTrail(reviewId: string): RiskGateAuditEntry[] {
  return auditStore.get(reviewId) ?? []
}

// ---------------------------------------------------------------------------
// Intercept Risk Stratification Response
// ---------------------------------------------------------------------------

/**
 * Intercepts a risk stratification AI response and marks it as
 * `pending_clinician_review`. Risk scores cannot enter the patient chart
 * without clinician approval.
 *
 * Performs a BAA compliance check first — if the BAA is not confirmed,
 * the attempt is blocked and recorded in the audit trail.
 */
export function interceptRiskScore(
  params: InterceptRiskScoreParams,
): RiskGateResult<RiskStratificationReview> {
  // Step 1: BAA compliance check
  const baaCheck = checkBAACompliance(params.aiSystemSource)

  if (!baaCheck.compliant) {
    // Block and audit
    recordAudit(
      generateReviewId(),
      params.patientId,
      params.riskScore,
      params.aiSystemSource,
      'blocked_non_baa',
      params.submittedByUserId,
      {
        reason: baaCheck.reason,
        verifiedEnvVar: baaCheck.verifiedEnvVar,
      },
    )

    return {
      ok: false,
      data: null,
      error: baaCheck.reason ?? 'BAA compliance check failed.',
    }
  }

  // Step 2: Create review record in pending_clinician_review state
  const reviewId = generateReviewId()
  const review: RiskStratificationReview = {
    id: reviewId,
    patientId: params.patientId,
    tenantId: params.tenantId,
    riskScore: params.riskScore,
    riskLevel: params.riskLevel,
    aiSystemSource: params.aiSystemSource,
    state: 'pending_clinician_review',
    submittedAt: nowIso(),
    reviewedAt: null,
    reviewingClinicianId: null,
    reviewingClinicianRole: null,
    reviewPermission: null,
    rejectionReason: null,
  }

  reviewStore.set(reviewId, review)

  // Step 3: Audit the submission
  recordAudit(
    reviewId,
    params.patientId,
    params.riskScore,
    params.aiSystemSource,
    'submitted',
    params.submittedByUserId,
  )

  return { ok: true, data: review, error: null }
}

// ---------------------------------------------------------------------------
// Clinician Approval / Rejection
// ---------------------------------------------------------------------------

/**
 * Verifies that the clinician role has permission to write to patient charts.
 * Only physicians and certain roles can approve risk scores for chart entry.
 */
async function canApproveRiskScore(
  role: ClinicalRole,
  patientId: string,
): Promise<EHRPermissionCheckResult> {
  return checkPermission(role, 'write_patient', patientId)
}

/**
 * Processes a clinician's review of a pending risk stratification score.
 *
 * Enforces:
 * - Review must exist and be in `pending_clinician_review` state.
 * - Reviewer must have `write_patient` permission (RBAC).
 * - On approval: state → `approved`, audit records reviewing clinician + approved_at.
 * - On rejection: state → `rejected`, audit records rejection reason.
 */
export async function reviewRiskScore(
  params: ReviewRiskScoreParams,
): Promise<RiskGateResult<RiskStratificationReview>> {
  const review = reviewStore.get(params.reviewId)

  if (!review) {
    return {
      ok: false,
      data: null,
      error: 'Risk stratification review not found.',
    }
  }

  if (review.state !== 'pending_clinician_review') {
    return {
      ok: false,
      data: null,
      error: `Risk review already ${review.state}. Cannot review again.`,
    }
  }

  // RBAC check — clinician must have write_patient permission
  const permResult = await canApproveRiskScore(
    params.clinicianRole,
    review.patientId,
  )

  if (!permResult.granted) {
    return {
      ok: false,
      data: null,
      error: `Clinician role '${params.clinicianRole}' lacks permission to approve risk scores: ${permResult.reason}`,
    }
  }

  if (!params.approved && !params.rejectionReason) {
    return {
      ok: false,
      data: null,
      error: 'Rejection reason is required when rejecting a risk score.',
    }
  }

  // Update review record
  const reviewedAt = nowIso()
  const updated: RiskStratificationReview = {
    ...review,
    state: params.approved ? 'approved' : 'rejected',
    reviewedAt,
    reviewingClinicianId: params.clinicianId,
    reviewingClinicianRole: params.clinicianRole,
    reviewPermission: permResult,
    rejectionReason: params.approved ? null : (params.rejectionReason ?? null),
  }

  reviewStore.set(params.reviewId, updated)

  // Audit the review decision
  recordAudit(
    params.reviewId,
    review.patientId,
    review.riskScore,
    review.aiSystemSource,
    params.approved ? 'approved' : 'rejected',
    params.clinicianId,
    {
      reviewingClinicianRole: params.clinicianRole,
      reviewingClinicianId: params.clinicianId,
      reviewedAt,
      rejectionReason: params.rejectionReason ?? null,
      permissionGranted: permResult.granted,
      breakGlassActivated: permResult.breakGlassActivated,
    },
  )

  return { ok: true, data: updated, error: null }
}

// ---------------------------------------------------------------------------
// Query Helpers
// ---------------------------------------------------------------------------

/**
 * Retrieves a risk stratification review by ID.
 */
export function getReview(reviewId: string): RiskStratificationReview | null {
  return reviewStore.get(reviewId) ?? null
}

/**
 * Returns all reviews for a given patient (within the gate's in-memory store).
 */
export function getReviewsForPatient(
  patientId: string,
): RiskStratificationReview[] {
  const results: RiskStratificationReview[] = []
  for (const review of reviewStore.values()) {
    if (review.patientId === patientId) {
      results.push(review)
    }
  }
  return results
}

// ---------------------------------------------------------------------------
// Test Helpers (exported for unit tests to reset state)
// ---------------------------------------------------------------------------

/**
 * Clears all in-memory review and audit records.
 * Intended for use in unit test setup/teardown only.
 */
export function resetGateStateForTests(): void {
  reviewStore.clear()
  auditStore.clear()
  reviewCounter = 0
  auditCounter = 0
}
