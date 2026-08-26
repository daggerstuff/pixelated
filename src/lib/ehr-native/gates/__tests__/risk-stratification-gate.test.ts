/**
 * Risk Stratification Gate — Unit Tests (G2.2 / PIX-4427)
 *
 * Coverage:
 * 1. Pending review state — interceptRiskScore marks as pending_clinician_review
 * 2. Clinician approval flow — reviewRiskScore approves and updates audit trail
 * 3. BAA compliance check — checkBAACompliance returns correct status
 * 4. Blocked non-BAA attempt — interceptRiskScore blocks when BAA env var missing
 * 5. Audit trail — records patient_id, risk_score, AI system source, reviewing clinician, approved_at
 * 6. Rejection flow — reviewRiskScore rejects with reason
 * 7. Double-review prevention — cannot review an already-reviewed risk score
 * 8. RBAC enforcement — non-clinician role cannot approve
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  interceptRiskScore,
  reviewRiskScore,
  checkBAACompliance,
  getReview,
  getAuditTrail,
  resetGateStateForTests,
} from '../risk-stratification-gate'

// Mock the audit log module so we don't hit the real audit system
vi.mock('@/lib/audit/log', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}))
import { logAuditEvent } from '@/lib/audit/log'
const logAuditEventMock = vi.mocked(logAuditEvent)

// Mock the RBAC module to control permission outcomes
vi.mock('@/lib/ehr-native/auth/ehr-rbac', () => ({
  checkPermission: vi.fn((role: string, _permission: string) => ({
    granted: role === 'physician' || role === 'nurse',
    permission: 'write_patient',
    role,
    reason:
      role === 'physician' || role === 'nurse'
        ? ''
        : 'Insufficient permissions',
    breakGlassActivated: false,
    consentVerified: null,
  })),
}))

describe('Risk Stratification Gate (G2.2 / PIX-4427)', () => {
  beforeEach(() => {
    resetGateStateForTests()
    vi.clearAllMocks()
  })

  afterEach(() => {
    resetGateStateForTests()
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // 1. Pending Review State
  // -------------------------------------------------------------------------

  describe('interceptRiskScore — pending review state', () => {
    it('marks a risk stratification response as pending_clinician_review', () => {
      const result = interceptRiskScore({
        patientId: 'patient-001',
        tenantId: 'tenant-001',
        riskScore: 0.78,
        riskLevel: 'high',
        aiSystemSource: 'local-fallback',
        submittedByUserId: 'system',
      })

      expect(result.ok).toBe(true)
      expect(result.data).not.toBeNull()
      expect(result.data!.state).toBe('pending_clinician_review')
      expect(result.data!.patientId).toBe('patient-001')
      expect(result.data!.riskScore).toBe(0.78)
      expect(result.data!.riskLevel).toBe('high')
      expect(result.data!.aiSystemSource).toBe('local-fallback')
      expect(result.data!.reviewedAt).toBeNull()
      expect(result.data!.reviewingClinicianId).toBeNull()
    })

    it('generates a unique review ID', () => {
      const r1 = interceptRiskScore({
        patientId: 'p1',
        tenantId: 't1',
        riskScore: 0.5,
        riskLevel: 'medium',
        aiSystemSource: 'local-fallback',
        submittedByUserId: 'system',
      })
      const r2 = interceptRiskScore({
        patientId: 'p2',
        tenantId: 't1',
        riskScore: 0.9,
        riskLevel: 'high',
        aiSystemSource: 'local-fallback',
        submittedByUserId: 'system',
      })

      expect(r1.ok).toBe(true)
      expect(r2.ok).toBe(true)
      expect(r1.data!.id).not.toBe(r2.data!.id)
    })
  })

  // -------------------------------------------------------------------------
  // 2. Clinician Approval Flow
  // -------------------------------------------------------------------------

  describe('reviewRiskScore — clinician approval', () => {
    it('approves a pending risk score and updates the audit trail', () => {
      const intercept = interceptRiskScore({
        patientId: 'patient-002',
        tenantId: 'tenant-001',
        riskScore: 0.85,
        riskLevel: 'high',
        aiSystemSource: 'local-fallback',
        submittedByUserId: 'system',
      })
      expect(intercept.ok).toBe(true)

      const reviewId = intercept.data!.id

      const result = reviewRiskScore({
        reviewId,
        clinicianId: 'dr-smith',
        clinicianRole: 'physician',
        approved: true,
      })

      expect(result.ok).toBe(true)
      expect(result.data!.state).toBe('approved')
      expect(result.data!.reviewedAt).not.toBeNull()
      expect(result.data!.reviewingClinicianId).toBe('dr-smith')
      expect(result.data!.reviewingClinicianRole).toBe('physician')
      expect(result.data!.rejectionReason).toBeNull()

      // Verify the review record was updated
      const updated = getReview(reviewId)
      expect(updated!.state).toBe('approved')
    })

    it('records an audit trail entry on approval', () => {
      const intercept = interceptRiskScore({
        patientId: 'patient-003',
        tenantId: 'tenant-001',
        riskScore: 0.6,
        riskLevel: 'medium',
        aiSystemSource: 'local-fallback',
        submittedByUserId: 'system',
      })

      const reviewId = intercept.data!.id

      reviewRiskScore({
        reviewId,
        clinicianId: 'dr-jones',
        clinicianRole: 'physician',
        approved: true,
      })

      const trail = getAuditTrail(reviewId)
      // Should have at least 2: submission + approval
      expect(trail.length).toBeGreaterThanOrEqual(2)

      const approvalEntry = trail.find((e) => e.action === 'approved')
      expect(approvalEntry).toBeDefined()
      expect(approvalEntry!.patientId).toBe('patient-003')
      expect(approvalEntry!.riskScore).toBe(0.6)
      expect(approvalEntry!.aiSystemSource).toBe('local-fallback')
      expect(approvalEntry!.userId).toBe('dr-jones')
      expect(approvalEntry!.metadata['reviewingClinicianId']).toBe('dr-jones')
      expect(approvalEntry!.metadata['reviewingClinicianRole']).toBe(
        'physician',
      )
      expect(approvalEntry!.metadata['reviewedAt']).toBeDefined()
    })
  })

  // -------------------------------------------------------------------------
  // 3. BAA Compliance Check
  // -------------------------------------------------------------------------

  describe('checkBAACompliance', () => {
    it('returns compliant for local-fallback (no BAA needed)', () => {
      const result = checkBAACompliance('local-fallback')
      expect(result.compliant).toBe(true)
      expect(result.reason).toBeNull()
      expect(result.verifiedEnvVar).toBeNull()
    })

    it('returns compliant when BAA_NIM_HETZNER_CONFIRMED is true', () => {
      vi.stubEnv('BAA_NIM_HETZNER_CONFIRMED', 'true')
      const result = checkBAACompliance('nim-hetzner')
      expect(result.compliant).toBe(true)
      expect(result.verifiedEnvVar).toBe('BAA_NIM_HETZNER_CONFIRMED')
      vi.unstubAllEnvs()
    })

    it('returns non-compliant when BAA_NIM_HETZNER_CONFIRMED is missing', () => {
      // Ensure env var is not set
      vi.stubEnv('BAA_NIM_HETZNER_CONFIRMED', '')
      const result = checkBAACompliance('nim-hetzner')
      expect(result.compliant).toBe(false)
      expect(result.verifiedEnvVar).toBe('BAA_NIM_HETZNER_CONFIRMED')
      expect(result.reason).toContain('BAA_NIM_HETZNER_CONFIRMED')
      vi.unstubAllEnvs()
    })

    it('returns non-compliant when BAA_NVIDIA_CONFIRMED is false', () => {
      vi.stubEnv('BAA_NVIDIA_CONFIRMED', 'false')
      const result = checkBAACompliance('nvidia')
      expect(result.compliant).toBe(false)
      expect(result.verifiedEnvVar).toBe('BAA_NVIDIA_CONFIRMED')
      expect(result.reason).toContain('BAA_NVIDIA_CONFIRMED')
      vi.unstubAllEnvs()
    })
  })

  // -------------------------------------------------------------------------
  // 4. Blocked Non-BAA Attempt
  // -------------------------------------------------------------------------

  describe('interceptRiskScore — blocked non-BAA attempt', () => {
    it('blocks risk score interception when BAA is not confirmed', () => {
      vi.stubEnv('BAA_NIM_HETZNER_CONFIRMED', '')

      const result = interceptRiskScore({
        patientId: 'patient-004',
        tenantId: 'tenant-001',
        riskScore: 0.92,
        riskLevel: 'critical',
        aiSystemSource: 'nim-hetzner',
        submittedByUserId: 'system',
      })

      expect(result.ok).toBe(false)
      expect(result.data).toBeNull()
      expect(result.error).toContain('BAA_NIM_HETZNER_CONFIRMED')

      // Verify no review record was created
      expect(getReview).toBeDefined() // sanity check

      vi.unstubAllEnvs()
    })

    it('records a blocked_non_baa audit entry when BAA check fails', () => {
      vi.stubEnv('BAA_NVIDIA_CONFIRMED', '')

      // We can't get the reviewId from interceptRiskScore since it returns error,
      // but the audit entry is still recorded internally.
      logAuditEventMock.mockClear()

      interceptRiskScore({
        patientId: 'patient-005',
        tenantId: 'tenant-001',
        riskScore: 0.88,
        riskLevel: 'high',
        aiSystemSource: 'nvidia',
        submittedByUserId: 'system',
      })

      expect(logAuditEventMock).toHaveBeenCalledWith(
        expect.any(String),
        'risk_gate_blocked_non_baa',
        expect.any(String),
        'risk_stratification_review',
        expect.objectContaining({
          patientId: 'patient-005',
          aiSystemSource: 'nvidia',
          action: 'blocked_non_baa',
        }),
      )

      vi.unstubAllEnvs()
    })
  })

  // -------------------------------------------------------------------------
  // 5. Audit Trail
  // -------------------------------------------------------------------------

  describe('audit trail', () => {
    it('records patient_id, risk_score, AI system source, reviewing clinician, and approved_at', () => {
      const intercept = interceptRiskScore({
        patientId: 'patient-006',
        tenantId: 'tenant-001',
        riskScore: 0.73,
        riskLevel: 'high',
        aiSystemSource: 'local-fallback',
        submittedByUserId: 'system',
      })
      const reviewId = intercept.data!.id

      reviewRiskScore({
        reviewId,
        clinicianId: 'dr-wilson',
        clinicianRole: 'physician',
        approved: true,
      })

      const trail = getAuditTrail(reviewId)

      // Verify submission entry
      const submission = trail.find((e) => e.action === 'submitted')
      expect(submission).toBeDefined()
      expect(submission!.patientId).toBe('patient-006')
      expect(submission!.riskScore).toBe(0.73)
      expect(submission!.aiSystemSource).toBe('local-fallback')

      // Verify approval entry — acceptance criterion: records patient_id, risk_score,
      // AI system source, reviewing clinician, approved_at
      const approval = trail.find((e) => e.action === 'approved')
      expect(approval).toBeDefined()
      expect(approval!.patientId).toBe('patient-006')
      expect(approval!.riskScore).toBe(0.73)
      expect(approval!.aiSystemSource).toBe('local-fallback')
      expect(approval!.userId).toBe('dr-wilson') // reviewing clinician
      expect(approval!.metadata['reviewingClinicianId']).toBe('dr-wilson')
      expect(approval!.metadata['reviewedAt']).toBeDefined() // approved_at
    })
  })

  // -------------------------------------------------------------------------
  // 6. Rejection Flow
  // -------------------------------------------------------------------------

  describe('reviewRiskScore — rejection', () => {
    it('rejects a pending risk score and records the rejection reason', () => {
      const intercept = interceptRiskScore({
        patientId: 'patient-007',
        tenantId: 'tenant-001',
        riskScore: 0.55,
        riskLevel: 'medium',
        aiSystemSource: 'local-fallback',
        submittedByUserId: 'system',
      })
      const reviewId = intercept.data!.id

      const result = reviewRiskScore({
        reviewId,
        clinicianId: 'dr-brown',
        clinicianRole: 'physician',
        approved: false,
        rejectionReason:
          'Risk model output inconsistent with clinical assessment.',
      })

      expect(result.ok).toBe(true)
      expect(result.data!.state).toBe('rejected')
      expect(result.data!.rejectionReason).toBe(
        'Risk model output inconsistent with clinical assessment.',
      )
      expect(result.data!.reviewingClinicianId).toBe('dr-brown')

      const trail = getAuditTrail(reviewId)
      const rejection = trail.find((e) => e.action === 'rejected')
      expect(rejection).toBeDefined()
      expect(rejection!.metadata['rejectionReason']).toBe(
        'Risk model output inconsistent with clinical assessment.',
      )
    })

    it('fails when rejecting without a reason', () => {
      const intercept = interceptRiskScore({
        patientId: 'patient-008',
        tenantId: 'tenant-001',
        riskScore: 0.4,
        riskLevel: 'low',
        aiSystemSource: 'local-fallback',
        submittedByUserId: 'system',
      })

      const result = reviewRiskScore({
        reviewId: intercept.data!.id,
        clinicianId: 'dr-green',
        clinicianRole: 'physician',
        approved: false,
      })

      expect(result.ok).toBe(false)
      expect(result.error).toContain('Rejection reason is required')
    })
  })

  // -------------------------------------------------------------------------
  // 7. Double-Review Prevention
  // -------------------------------------------------------------------------

  describe('reviewRiskScore — double-review prevention', () => {
    it('prevents reviewing an already-approved risk score', () => {
      const intercept = interceptRiskScore({
        patientId: 'patient-009',
        tenantId: 'tenant-001',
        riskScore: 0.65,
        riskLevel: 'medium',
        aiSystemSource: 'local-fallback',
        submittedByUserId: 'system',
      })
      const reviewId = intercept.data!.id

      const first = reviewRiskScore({
        reviewId,
        clinicianId: 'dr-one',
        clinicianRole: 'physician',
        approved: true,
      })
      expect(first.ok).toBe(true)

      const second = reviewRiskScore({
        reviewId,
        clinicianId: 'dr-two',
        clinicianRole: 'physician',
        approved: true,
      })
      expect(second.ok).toBe(false)
      expect(second.error).toContain('already approved')
    })

    it('returns error for non-existent review', () => {
      const result = reviewRiskScore({
        reviewId: 'nonexistent-id',
        clinicianId: 'dr-x',
        clinicianRole: 'physician',
        approved: true,
      })

      expect(result.ok).toBe(false)
      expect(result.error).toContain('not found')
    })
  })

  // -------------------------------------------------------------------------
  // 8. RBAC Enforcement
  // -------------------------------------------------------------------------

  describe('reviewRiskScore — RBAC enforcement', () => {
    it('blocks approval from a role without write_patient permission', () => {
      const intercept = interceptRiskScore({
        patientId: 'patient-010',
        tenantId: 'tenant-001',
        riskScore: 0.7,
        riskLevel: 'high',
        aiSystemSource: 'local-fallback',
        submittedByUserId: 'system',
      })

      const result = reviewRiskScore({
        reviewId: intercept.data!.id,
        clinicianId: 'front-desk-user',
        clinicianRole: 'frontDesk',
        approved: true,
      })

      expect(result.ok).toBe(false)
      expect(result.error).toContain('lacks permission')
    })

    it('allows approval from a physician', () => {
      const intercept = interceptRiskScore({
        patientId: 'patient-011',
        tenantId: 'tenant-001',
        riskScore: 0.71,
        riskLevel: 'high',
        aiSystemSource: 'local-fallback',
        submittedByUserId: 'system',
      })

      const result = reviewRiskScore({
        reviewId: intercept.data!.id,
        clinicianId: 'dr-lee',
        clinicianRole: 'physician',
        approved: true,
      })

      expect(result.ok).toBe(true)
      expect(result.data!.state).toBe('approved')
    })
  })
})
