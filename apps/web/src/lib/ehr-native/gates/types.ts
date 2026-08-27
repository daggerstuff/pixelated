/**
 * Risk Stratification Gate — Type Definitions
 * G2.2 Compliance gate ensuring risk stratification output is reviewed by a clinician
 * before entering patient chart.
 *
 * Acceptance criterion: risk scores cannot be written to patient chart without clinician approval.
 */

import type {
  ClinicalRole,
  EHRPermissionCheckResult,
} from '@/lib/ehr-native/auth/types'

/** States a risk stratification review can be in. */
type RiskReviewState = 'pending_clinician_review' | 'approved' | 'rejected'

/** AI system source identifiers for risk stratification. */
export type RiskAISystemSource = 'nim-hetzner' | 'nvidia' | 'local-fallback'

/** Result of a BAA compliance check before processing risk data. */
export interface BAAComplianceCheck {
  /** Whether a BAA is confirmed with the AI provider. */
  compliant: boolean
  /** The AI provider that was checked. */
  provider: RiskAISystemSource
  /** Human-readable reason for non-compliance, if any. */
  reason: string | null
  /** Environment variable name that was verified (or missing). */
  verifiedEnvVar: string | null
}

/** A risk stratification output awaiting or having received clinician review. */
export interface RiskStratificationReview {
  /** Unique identifier for this review record. */
  id: string
  /** Patient identifier the risk score applies to. */
  patientId: string
  /** Tenant identifier for data isolation. */
  tenantId: string
  /** The raw risk score produced by the AI system. */
  riskScore: number
  /** Free-text risk assessment or stratification level. */
  riskLevel: string
  /** Which AI system produced this risk score. */
  aiSystemSource: RiskAISystemSource
  /** Current state of clinician review. */
  state: RiskReviewState
  /** When the risk score was submitted for review. */
  submittedAt: string
  /** When a clinician approved or rejected the score, if applicable. */
  reviewedAt: string | null
  /** The clinician who reviewed the risk score, if applicable. */
  reviewingClinicianId: string | null
  /** The role of the reviewing clinician. */
  reviewingClinicianRole: ClinicalRole | null
  /** RBAC permission check result at the time of review. */
  reviewPermission: EHRPermissionCheckResult | null
  /** Clinician's reason for rejection, if rejected. */
  rejectionReason: string | null
}

/** Audit trail entry for risk stratification gate events. */
export interface RiskGateAuditEntry {
  /** Unique identifier. */
  id: string
  /** The review record this audit entry pertains to. */
  reviewId: string
  /** Patient the risk score applies to. */
  patientId: string
  /** The risk score that was reviewed. */
  riskScore: number
  /** AI system that produced the score. */
  aiSystemSource: RiskAISystemSource
  /** Action taken: submitted, approved, rejected, blocked. */
  action: 'submitted' | 'approved' | 'rejected' | 'blocked_non_baa'
  /** The user who performed the action. */
  userId: string
  /** When the action occurred. */
  timestamp: string
  /** Additional metadata for the audit entry. */
  metadata: Record<string, unknown>
}

/** Parameters for intercepting a risk stratification AI response. */
export interface InterceptRiskScoreParams {
  patientId: string
  tenantId: string
  riskScore: number
  riskLevel: string
  aiSystemSource: RiskAISystemSource
  /** The user/system that submitted the risk score for review. */
  submittedByUserId: string
}

/** Parameters for a clinician approving or rejecting a risk score. */
export interface ReviewRiskScoreParams {
  reviewId: string
  clinicianId: string
  clinicianRole: ClinicalRole
  /** Whether to approve (true) or reject (false). */
  approved: boolean
  /** Reason for rejection, required when approved=false. */
  rejectionReason?: string
}

/** Result of intercepting or reviewing a risk score. */
export interface RiskGateResult<T> {
  ok: boolean
  data: T | null
  error: string | null
}
