/**
 * Tests for EHR Native Risk Stratification Service (F2.2 / PIX-4411)
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import type {
  RiskStratificationReview,
  RiskGateResult,
  RiskGateAuditEntry,
} from '@/lib/ehr-native/gates/types'
import type { RLSContext } from '@/lib/ehr-native/repositories/base-repository'

// ---------------------------------------------------------------------------
// Gate mocks
// ---------------------------------------------------------------------------

const mockInterceptRiskScore = vi.fn()
const mockGetReview = vi.fn()
const mockGetReviewsForPatient = vi.fn()
const mockGetAuditTrail = vi.fn()

vi.mock('@/lib/ehr-native/gates/risk-stratification-gate', () => ({
  interceptRiskScore: mockInterceptRiskScore,
  getReview: mockGetReview,
  getReviewsForPatient: mockGetReviewsForPatient,
  getAuditTrail: mockGetAuditTrail,
}))

// ---------------------------------------------------------------------------
// Fetch mock
// ---------------------------------------------------------------------------

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ---------------------------------------------------------------------------
// Dynamic import after mocks are set up
// ---------------------------------------------------------------------------

async function importService() {
  const mod = await import('@/lib/ehr-native/services/risk.service')
  return mod
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const rlsContext: RLSContext = {
  tenantId: 'tenant-001',
  userId: 'clinician-001',
  role: 'physician',
  breakGlass: false,
}

const validRequest = {
  phq9: { responses: [0, 0, 0, 0, 0, 0, 0, 0, 0] },
  gad7: { responses: [0, 0, 0, 0, 0, 0, 0] },
  cssrs: { responses: [false, false, false, false, false, false] },
  clinical_context: {
    note_text: 'Patient presents with mild anxiety.',
    session_id: 'session-001',
    patient_id: 'patient-001',
  },
}

const lowRiskResponse = {
  patient_id: 'pid:a1b2c3',
  session_id: 'sid:d4e5f6',
  risk_level: 'low',
  confidence_score: 0.95,
  score_breakdown: {
    phq9_total: 0,
    phq9_severity: 'minimal',
    gad7_total: 0,
    gad7_severity: 'minimal',
    cssrs_highest_positive: 0,
    cssrs_risk_label: 'none',
  },
  recommended_actions: ['Routine monitoring at next visit'],
  requires_supervisor_review: false,
  requires_crisis_protocol: false,
  model_source: 'nim-hetzner',
  warnings: [],
  audit_entry_id: 'audit-001',
}

const highRiskResponse = {
  ...lowRiskResponse,
  risk_level: 'high',
  confidence_score: 0.82,
  requires_supervisor_review: true,
  recommended_actions: ['Immediate supervisor review', 'Safety plan update'],
  audit_entry_id: 'audit-002',
}

const crisisRiskResponse = {
  ...lowRiskResponse,
  risk_level: 'crisis',
  confidence_score: 0.91,
  requires_supervisor_review: true,
  requires_crisis_protocol: true,
  recommended_actions: [
    'Emergency protocol activation',
    '988 crisis line referral',
  ],
  audit_entry_id: 'audit-003',
}

function makeReview(
  overrides: Partial<RiskStratificationReview> = {},
): RiskStratificationReview {
  return {
    id: 'review-001',
    patientId: 'patient-001',
    tenantId: 'tenant-001',
    riskScore: 0.82,
    riskLevel: 'high',
    aiSystemSource: 'nim-hetzner' as const,
    state: 'pending_clinician_review' as const,
    submittedAt: '2026-08-28T12:00:00Z',
    reviewedAt: null,
    reviewingClinicianId: null,
    reviewingClinicianRole: null,
    reviewPermission: null,
    rejectionReason: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RiskStratificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('RISK_STRATIFICATION_API_URL', 'http://test-api:8000')
    vi.stubEnv('RISK_STRATIFICATION_TIMEOUT_MS', '5000')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // -------------------------------------------------------------------------
  // stratifyRisk — low risk (no gate routing)
  // -------------------------------------------------------------------------

  describe('stratifyRisk — low risk', () => {
    it('should return response without gate routing for low risk', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => lowRiskResponse,
      })

      const { RiskStratificationService } = await importService()
      const service = new RiskStratificationService(rlsContext)
      const result = await service.stratifyRisk(validRequest)

      expect(result.response.risk_level).toBe('low')
      expect(result.gateReview).toBeNull()
      expect(result.gateAccepted).toBe(true)
      expect(result.gateError).toBeNull()
      expect(mockInterceptRiskScore).not.toHaveBeenCalled()
    })

    it('should send POST request to /stratify with correct body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => lowRiskResponse,
      })

      const { RiskStratificationService } = await importService()
      const service = new RiskStratificationService(rlsContext)
      await service.stratifyRisk(validRequest)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api:8000/stratify',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validRequest),
        }),
      )
    })
  })

  // -------------------------------------------------------------------------
  // stratifyRisk — high/crisis (gate routing)
  // -------------------------------------------------------------------------

  describe('stratifyRisk — high/crisis gate routing', () => {
    it('should route high risk through the gate', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => highRiskResponse,
      })

      const review = makeReview()
      const gateResult: RiskGateResult<RiskStratificationReview> = {
        ok: true,
        data: review,
        error: null,
      }
      mockInterceptRiskScore.mockReturnValueOnce(gateResult)

      const { RiskStratificationService } = await importService()
      const service = new RiskStratificationService(rlsContext)
      const result = await service.stratifyRisk(validRequest)

      expect(mockInterceptRiskScore).toHaveBeenCalledWith({
        patientId: 'patient-001',
        tenantId: 'tenant-001',
        riskScore: 0.82,
        riskLevel: 'high',
        aiSystemSource: 'nim-hetzner',
        submittedByUserId: 'clinician-001',
      })
      expect(result.gateReview).toEqual(review)
      expect(result.gateAccepted).toBe(true)
    })

    it('should route crisis risk through the gate', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => crisisRiskResponse,
      })

      const review = makeReview({
        riskLevel: 'crisis',
        riskScore: 0.91,
      })
      mockInterceptRiskScore.mockReturnValueOnce({
        ok: true,
        data: review,
        error: null,
      })

      const { RiskStratificationService } = await importService()
      const service = new RiskStratificationService(rlsContext)
      const result = await service.stratifyRisk(validRequest)

      expect(result.response.risk_level).toBe('crisis')
      expect(mockInterceptRiskScore).toHaveBeenCalled()
      expect(result.gateAccepted).toBe(true)
    })

    it('should handle gate rejection (BAA not compliant)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => highRiskResponse,
      })

      mockInterceptRiskScore.mockReturnValueOnce({
        ok: false,
        data: null,
        error: 'BAA not confirmed for provider nim-hetzner',
      })

      const { RiskStratificationService } = await importService()
      const service = new RiskStratificationService(rlsContext)
      const result = await service.stratifyRisk(validRequest)

      expect(result.gateAccepted).toBe(false)
      expect(result.gateError).toBe(
        'BAA not confirmed for provider nim-hetzner',
      )
      expect(result.gateReview).toBeNull()
    })

    it('should route through gate when requires_supervisor_review is true even for medium', async () => {
      const mediumWithReview = {
        ...lowRiskResponse,
        risk_level: 'medium',
        requires_supervisor_review: true,
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mediumWithReview,
      })

      const review = makeReview({ riskLevel: 'medium' })
      mockInterceptRiskScore.mockReturnValueOnce({
        ok: true,
        data: review,
        error: null,
      })

      const { RiskStratificationService } = await importService()
      const service = new RiskStratificationService(rlsContext)
      const result = await service.stratifyRisk(validRequest)

      expect(mockInterceptRiskScore).toHaveBeenCalled()
      expect(result.gateAccepted).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // stratifyRisk — API errors
  // -------------------------------------------------------------------------

  describe('stratifyRisk — error handling', () => {
    it('should throw BAA error on 403', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'BAA not confirmed',
      })

      const { RiskStratificationService } = await importService()
      const service = new RiskStratificationService(rlsContext)
      await expect(service.stratifyRisk(validRequest)).rejects.toThrow(
        /BAA not confirmed/,
      )
    })

    it('should throw validation error on 422', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        text: async () => 'phq9.responses must have 9 items',
      })

      const { RiskStratificationService } = await importService()
      const service = new RiskStratificationService(rlsContext)
      await expect(service.stratifyRisk(validRequest)).rejects.toThrow(
        /Validation error/,
      )
    })

    it('should throw service error on 502', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        text: async () => 'NIM service unavailable',
      })

      const { RiskStratificationService } = await importService()
      const service = new RiskStratificationService(rlsContext)
      await expect(service.stratifyRisk(validRequest)).rejects.toThrow(
        /Risk stratification service error/,
      )
    })

    it('should throw generic error on 500', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Internal error',
      })

      const { RiskStratificationService } = await importService()
      const service = new RiskStratificationService(rlsContext)
      await expect(service.stratifyRisk(validRequest)).rejects.toThrow(
        /Risk stratification service error \(500\)/,
      )
    })
  })

  // -------------------------------------------------------------------------
  // checkHealth
  // -------------------------------------------------------------------------

  describe('checkHealth', () => {
    it('should return health status on success', async () => {
      const healthResponse = {
        status: 'ok',
        service: 'risk-stratification',
        baa_confirmed: true,
        nim_configured: true,
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => healthResponse,
      })

      const { RiskStratificationService } = await importService()
      const service = new RiskStratificationService(rlsContext)
      const health = await service.checkHealth()

      expect(health.status).toBe('ok')
      expect(health.service).toBe('risk-stratification')
      expect(health.baa_confirmed).toBe(true)
      expect(health.nim_configured).toBe(true)
    })

    it('should throw on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      })

      const { RiskStratificationService } = await importService()
      const service = new RiskStratificationService(rlsContext)
      await expect(service.checkHealth()).rejects.toThrow(/Health check failed/)
    })

    it('should call /health endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'ok',
          service: 'risk-stratification',
          baa_confirmed: false,
          nim_configured: false,
        }),
      })

      const { RiskStratificationService } = await importService()
      const service = new RiskStratificationService(rlsContext)
      await service.checkHealth()

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api:8000/health',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      )
    })
  })

  // -------------------------------------------------------------------------
  // Gate delegation methods
  // -------------------------------------------------------------------------

  describe('getReview', () => {
    it('should delegate to gate getReview', async () => {
      const review = makeReview()
      mockGetReview.mockReturnValueOnce(review)

      const { RiskStratificationService } = await importService()
      const service = new RiskStratificationService(rlsContext)
      const result = service.getReview('review-001')

      expect(mockGetReview).toHaveBeenCalledWith('review-001')
      expect(result).toEqual(review)
    })

    it('should return null when review not found', async () => {
      mockGetReview.mockReturnValueOnce(null)

      const { RiskStratificationService } = await importService()
      const service = new RiskStratificationService(rlsContext)
      const result = service.getReview('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('getReviewsForPatient', () => {
    it('should delegate to gate getReviewsForPatient', async () => {
      const reviews = [makeReview(), makeReview({ id: 'review-002' })]
      mockGetReviewsForPatient.mockReturnValueOnce(reviews)

      const { RiskStratificationService } = await importService()
      const service = new RiskStratificationService(rlsContext)
      const result = service.getReviewsForPatient('patient-001')

      expect(mockGetReviewsForPatient).toHaveBeenCalledWith('patient-001')
      expect(result).toHaveLength(2)
    })

    it('should return empty array when no reviews', async () => {
      mockGetReviewsForPatient.mockReturnValueOnce([])

      const { RiskStratificationService } = await importService()
      const service = new RiskStratificationService(rlsContext)
      const result = service.getReviewsForPatient('patient-001')

      expect(result).toEqual([])
    })
  })

  describe('getAuditTrail', () => {
    it('should delegate to gate getAuditTrail', async () => {
      const auditEntries: RiskGateAuditEntry[] = [
        {
          id: 'audit-001',
          reviewId: 'review-001',
          patientId: 'patient-001',
          riskScore: 0.82,
          aiSystemSource: 'nim-hetzner' as const,
          action: 'submitted' as const,
          userId: 'clinician-001',
          timestamp: '2026-08-28T12:00:00Z',
          metadata: {},
        },
      ]
      mockGetAuditTrail.mockReturnValueOnce(auditEntries)

      const { RiskStratificationService } = await importService()
      const service = new RiskStratificationService(rlsContext)
      const result = service.getAuditTrail('review-001')

      expect(mockGetAuditTrail).toHaveBeenCalledWith('review-001')
      expect(result).toHaveLength(1)
      expect(result[0].action).toBe('submitted')
    })

    it('should return empty array when no audit entries', async () => {
      mockGetAuditTrail.mockReturnValueOnce([])

      const { RiskStratificationService } = await importService()
      const service = new RiskStratificationService(rlsContext)
      const result = service.getAuditTrail('review-001')

      expect(result).toEqual([])
    })
  })

  // -------------------------------------------------------------------------
  // resolveAISystemSource (tested indirectly via stratifyRisk)
  // -------------------------------------------------------------------------

  describe('resolveAISystemSource', () => {
    it('should map nim-hetzner correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => highRiskResponse,
      })
      mockInterceptRiskScore.mockReturnValueOnce({
        ok: true,
        data: makeReview(),
        error: null,
      })

      const { RiskStratificationService } = await importService()
      const service = new RiskStratificationService(rlsContext)
      await service.stratifyRisk(validRequest)

      expect(mockInterceptRiskScore).toHaveBeenCalledWith(
        expect.objectContaining({ aiSystemSource: 'nim-hetzner' }),
      )
    })

    it('should map nvidia correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ...highRiskResponse,
          model_source: 'nvidia',
        }),
      })
      mockInterceptRiskScore.mockReturnValueOnce({
        ok: true,
        data: makeReview(),
        error: null,
      })

      const { RiskStratificationService } = await importService()
      const service = new RiskStratificationService(rlsContext)
      await service.stratifyRisk(validRequest)

      expect(mockInterceptRiskScore).toHaveBeenCalledWith(
        expect.objectContaining({ aiSystemSource: 'nvidia' }),
      )
    })

    it('should map unknown sources to local-fallback', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ...highRiskResponse,
          model_source: 'mock',
        }),
      })
      mockInterceptRiskScore.mockReturnValueOnce({
        ok: true,
        data: makeReview(),
        error: null,
      })

      const { RiskStratificationService } = await importService()
      const service = new RiskStratificationService(rlsContext)
      await service.stratifyRisk(validRequest)

      expect(mockInterceptRiskScore).toHaveBeenCalledWith(
        expect.objectContaining({ aiSystemSource: 'local-fallback' }),
      )
    })
  })

  // -------------------------------------------------------------------------
  // Default API URL and timeout
  // -------------------------------------------------------------------------

  describe('default configuration', () => {
    it('should use default API URL when env not set', async () => {
      vi.unstubAllEnvs()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => lowRiskResponse,
      })

      const { RiskStratificationService } = await importService()
      const service = new RiskStratificationService(rlsContext)
      await service.stratifyRisk(validRequest)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/stratify',
        expect.any(Object),
      )
    })
  })
})
