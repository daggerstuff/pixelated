/**
 * Tests for EHR Native Consent Service (F1.4)
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const { mockQuery, mockRepo } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockRepo: {
    create: vi.fn(),
    getById: vi.fn(),
    getByPatient: vi.fn(),
    getActiveByPatient: vi.fn(),
    listByTenant: vi.fn(),
    update: vi.fn(),
    revoke: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({
  query: mockQuery,
  transaction: vi.fn(),
}))

vi.mock('./repository', () => ({
  ConsentRepository: class MockConsentRepository {
    create = mockRepo.create
    getById = mockRepo.getById
    getByPatient = mockRepo.getByPatient
    getActiveByPatient = mockRepo.getActiveByPatient
    listByTenant = mockRepo.listByTenant
    update = mockRepo.update
    revoke = mockRepo.revoke
    delete = mockRepo.delete
  },
}))

vi.mock('./state-rules/cache', () => ({
  stateConsentRulesCache: {
    getActiveRule: vi.fn().mockResolvedValue(null),
    getRuleConfig: vi.fn().mockResolvedValue(null),
    invalidate: vi.fn().mockResolvedValue(undefined),
    invalidateState: vi.fn().mockResolvedValue(undefined),
    invalidateAll: vi.fn().mockResolvedValue(undefined),
    warmCache: vi.fn().mockResolvedValue(undefined),
  },
  StateConsentRulesCache: vi.fn(),
}))

import type { ConsentLevel } from '@/lib/research/types/research-types'

import type { Consent } from '../types/consent'
import type { ConsentRow } from './repository'
// Import after mocks
import { ConsentService, type ConsentVerificationResult } from './service'
import {
  clearStateRules,
  registerStateRules,
  DEFAULT_STATE_RULES,
  type StateConsentRules,
} from './state-rules'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConsentRow(overrides: Partial<ConsentRow> = {}): ConsentRow {
  return {
    consent_id: 'consent-1',
    tenant_id: 'tenant-1',
    patient_id: 'patient-1',
    status: 'active',
    scope: 'treatment',
    category: 'default',
    consent_level: 'minimal',
    period_start: '2025-01-01',
    period_end: '2099-12-31', // far future so not expired by default
    fhir_resource: {} as Consent,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

function mockSqlResult(
  hasConsent: boolean,
  consentLevel: string = 'minimal',
): void {
  mockQuery.mockResolvedValue({
    rows: [{ has_consent: hasConsent, consent_level: consentLevel }],
    rowCount: 1,
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConsentService', () => {
  let service: ConsentService

  beforeEach(() => {
    vi.clearAllMocks()
    clearStateRules()
    service = new ConsentService()
  })

  // -------------------------------------------------------------------------
  // verifyConsent
  // -------------------------------------------------------------------------

  describe('verifyConsent', () => {
    it('returns verified=true when SQL function says consent is sufficient and not expired', async () => {
      mockSqlResult(true)
      mockRepo.getActiveByPatient.mockResolvedValue(
        makeConsentRow({ consent_level: 'full' }),
      )

      const result = await service.verifyConsent(
        'patient-1',
        'tenant-1',
        'minimal',
      )

      expect(result.verified).toBe(true)
      expect(result.consentLevel).toBe('full')
      expect(result.expired).toBe(false)
      expect(result.reason).toBe('Consent verified')
    })

    it('returns verified=false when SQL function says consent is insufficient', async () => {
      mockSqlResult(false)
      mockRepo.getActiveByPatient.mockResolvedValue(makeConsentRow())

      const result = await service.verifyConsent(
        'patient-1',
        'tenant-1',
        'full',
      )

      expect(result.verified).toBe(false)
      expect(result.consentLevel).toBe('none')
      expect(result.reason).toBe('Patient does not have sufficient consent')
    })

    it('returns verified=false when consent has expired', async () => {
      mockSqlResult(true)
      const expiredRow = makeConsentRow({ period_end: '2020-01-01' })
      mockRepo.getActiveByPatient.mockResolvedValue(expiredRow)

      const result = await service.verifyConsent(
        'patient-1',
        'tenant-1',
        'minimal',
      )

      expect(result.verified).toBe(false)
      expect(result.expired).toBe(true)
      expect(result.reason).toBe('Consent has expired')
    })

    it('returns expired=true when no active consent exists (null row)', async () => {
      mockSqlResult(false)
      mockRepo.getActiveByPatient.mockResolvedValue(null)

      const result = await service.verifyConsent(
        'patient-1',
        'tenant-1',
        'minimal',
      )

      expect(result.expired).toBe(true)
      expect(result.verified).toBe(false)
    })

    it('returns expired=false when consent has no period_end', async () => {
      mockSqlResult(true)
      const noEndRow = makeConsentRow({ period_end: null })
      mockRepo.getActiveByPatient.mockResolvedValue(noEndRow)

      const result = await service.verifyConsent(
        'patient-1',
        'tenant-1',
        'minimal',
      )

      expect(result.expired).toBe(false)
      expect(result.verified).toBe(true)
    })

    it('calls the SQL function ehr_patient_has_consent with correct params', async () => {
      mockSqlResult(true)
      mockRepo.getActiveByPatient.mockResolvedValue(makeConsentRow())

      await service.verifyConsent('patient-1', 'tenant-1', 'limited')

      const [sql, params] = mockQuery.mock.calls[0]
      expect(sql).toBe('SELECT * FROM ehr_patient_has_consent($1, $2, $3)')
      expect(params).toEqual(['patient-1', 'tenant-1', 'limited'])
    })
  })

  // -------------------------------------------------------------------------
  // verifyConsent with state rules
  // -------------------------------------------------------------------------

  describe('verifyConsent with state rules', () => {
    it('applies state rules when stateCode is provided and passes', async () => {
      mockSqlResult(true)
      mockRepo.getActiveByPatient.mockResolvedValue(
        makeConsentRow({ consent_level: 'full' }),
      )

      const result = await service.verifyConsent(
        'patient-1',
        'tenant-1',
        'minimal',
        'CA',
      )

      expect(result.verified).toBe(true)
      expect(result.stateRules).toBeDefined()
      expect(result.stateRules).toEqual(DEFAULT_STATE_RULES)
    })

    it('fails when state override requires higher consent than patient has', async () => {
      mockSqlResult(true)
      mockRepo.getActiveByPatient.mockResolvedValue(
        makeConsentRow({ consent_level: 'minimal' }),
      )

      const caRules: StateConsentRules = {
        ...DEFAULT_STATE_RULES,
        overrideConsentLevel: 'full',
      }
      registerStateRules('CA', caRules)

      const result = await service.verifyConsent(
        'patient-1',
        'tenant-1',
        'minimal',
        'CA',
      )

      expect(result.verified).toBe(false)
      expect(result.reason).toBe('State-specific consent requirements not met')
    })

    it('passes when state override matches patient consent level', async () => {
      mockSqlResult(true)
      mockRepo.getActiveByPatient.mockResolvedValue(
        makeConsentRow({ consent_level: 'limited' }),
      )

      const caRules: StateConsentRules = {
        ...DEFAULT_STATE_RULES,
        overrideConsentLevel: 'limited',
      }
      registerStateRules('CA', caRules)

      const result = await service.verifyConsent(
        'patient-1',
        'tenant-1',
        'minimal',
        'CA',
      )

      expect(result.verified).toBe(true)
    })

    it('requires limited consent for mental_health treatment when state requires it', async () => {
      mockSqlResult(true)
      mockRepo.getActiveByPatient.mockResolvedValue(
        makeConsentRow({ consent_level: 'minimal' }),
      )

      const result = await service.verifyConsent(
        'patient-1',
        'tenant-1',
        'minimal',
        'CA',
        'mental_health',
      )

      expect(result.verified).toBe(false)
      expect(result.reason).toBe('State-specific consent requirements not met')
    })

    it('passes mental health check when consent level is limited or higher', async () => {
      mockSqlResult(true)
      mockRepo.getActiveByPatient.mockResolvedValue(
        makeConsentRow({ consent_level: 'limited' }),
      )

      const result = await service.verifyConsent(
        'patient-1',
        'tenant-1',
        'minimal',
        'CA',
        'mental_health',
      )

      expect(result.verified).toBe(true)
    })

    it('requires limited consent for substance_use_disorder treatment', async () => {
      mockSqlResult(true)
      mockRepo.getActiveByPatient.mockResolvedValue(
        makeConsentRow({ consent_level: 'minimal' }),
      )

      const result = await service.verifyConsent(
        'patient-1',
        'tenant-1',
        'minimal',
        'CA',
        'substance_use_disorder',
      )

      expect(result.verified).toBe(false)
    })

    it('passes SUD check when consent level is limited or higher', async () => {
      mockSqlResult(true)
      mockRepo.getActiveByPatient.mockResolvedValue(
        makeConsentRow({ consent_level: 'limited' }),
      )

      const result = await service.verifyConsent(
        'patient-1',
        'tenant-1',
        'minimal',
        'CA',
        'substance_use_disorder',
      )

      expect(result.verified).toBe(true)
    })

    it('invokes custom validateConsent callback when present', async () => {
      mockSqlResult(true)
      mockRepo.getActiveByPatient.mockResolvedValue(
        makeConsentRow({ consent_level: 'full' }),
      )

      const validateConsent = vi.fn(() => false)
      const caRules: StateConsentRules = {
        ...DEFAULT_STATE_RULES,
        validateConsent,
      }
      registerStateRules('CA', caRules)

      const result = await service.verifyConsent(
        'patient-1',
        'tenant-1',
        'minimal',
        'CA',
        'mental_health',
      )

      expect(result.verified).toBe(false)
      expect(validateConsent).toHaveBeenCalledTimes(1)
      expect(validateConsent).toHaveBeenCalledWith(
        'patient-1',
        'full',
        'mental_health',
      )
    })

    it('state rules can elevate but not lower the minimum consent', async () => {
      mockSqlResult(true)
      mockRepo.getActiveByPatient.mockResolvedValue(
        makeConsentRow({ consent_level: 'minimal' }),
      )

      // Override sets minimum to 'minimal' but patient has 'minimal' - should pass
      const caRules: StateConsentRules = {
        ...DEFAULT_STATE_RULES,
        minimumConsentLevel: 'minimal',
        overrideConsentLevel: undefined,
      }
      registerStateRules('CA', caRules)

      const result = await service.verifyConsent(
        'patient-1',
        'tenant-1',
        'minimal',
        'CA',
      )

      expect(result.verified).toBe(true)
    })

    it('does not apply state rules when stateCode is not provided', async () => {
      mockSqlResult(true)
      mockRepo.getActiveByPatient.mockResolvedValue(makeConsentRow())

      const result = await service.verifyConsent(
        'patient-1',
        'tenant-1',
        'minimal',
      )

      expect(result.stateRules).toBeUndefined()
      expect(result.verified).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // getEffectiveConsentLevel
  // -------------------------------------------------------------------------

  describe('getEffectiveConsentLevel', () => {
    it('returns the consent level from the active consent record', async () => {
      mockRepo.getActiveByPatient.mockResolvedValue(
        makeConsentRow({ consent_level: 'full' }),
      )

      const result = await service.getEffectiveConsentLevel(
        'patient-1',
        'tenant-1',
      )

      expect(result).toBe('full')
      expect(mockRepo.getActiveByPatient).toHaveBeenCalledWith(
        'patient-1',
        'tenant-1',
      )
    })

    it('returns none when no active consent exists', async () => {
      mockRepo.getActiveByPatient.mockResolvedValue(null)

      const result = await service.getEffectiveConsentLevel(
        'patient-1',
        'tenant-1',
      )

      expect(result).toBe('none')
    })

    it('returns none when active consent has expired', async () => {
      const expiredRow = makeConsentRow({ period_end: '2020-01-01' })
      mockRepo.getActiveByPatient.mockResolvedValue(expiredRow)

      const result = await service.getEffectiveConsentLevel(
        'patient-1',
        'tenant-1',
      )

      expect(result).toBe('none')
    })

    it('returns consent level when period_end is null (no expiry)', async () => {
      const noEndRow = makeConsentRow({
        consent_level: 'limited',
        period_end: null,
      })
      mockRepo.getActiveByPatient.mockResolvedValue(noEndRow)

      const result = await service.getEffectiveConsentLevel(
        'patient-1',
        'tenant-1',
      )

      expect(result).toBe('limited')
    })
  })

  // -------------------------------------------------------------------------
  // createConsent
  // -------------------------------------------------------------------------

  describe('createConsent', () => {
    it('delegates to repository.create with the provided options', async () => {
      const fhir = { resourceType: 'Consent' } as unknown as Consent
      const row = makeConsentRow({ consent_level: 'full' })
      mockRepo.create.mockResolvedValue(row)

      const result = await service.createConsent({
        tenantId: 'tenant-1',
        patientId: 'patient-1',
        consentLevel: 'full',
        fhirResource: fhir,
      })

      expect(result).toEqual(row)
      expect(mockRepo.create).toHaveBeenCalledTimes(1)
      const input = mockRepo.create.mock.calls[0][0]
      expect(input.tenantId).toBe('tenant-1')
      expect(input.patientId).toBe('patient-1')
      expect(input.consentLevel).toBe('full')
      expect(input.fhirResource).toBe(fhir)
    })

    it('passes optional fields through to repository', async () => {
      const fhir = {} as Consent
      const row = makeConsentRow()
      mockRepo.create.mockResolvedValue(row)

      await service.createConsent({
        tenantId: 't1',
        patientId: 'p1',
        consentLevel: 'limited',
        scope: 'research',
        category: 'cat-1',
        periodStart: '2025-01-01',
        periodEnd: '2026-01-01',
        fhirResource: fhir,
      })

      const input = mockRepo.create.mock.calls[0][0]
      expect(input.scope).toBe('research')
      expect(input.category).toBe('cat-1')
      expect(input.periodStart).toBe('2025-01-01')
      expect(input.periodEnd).toBe('2026-01-01')
    })
  })

  // -------------------------------------------------------------------------
  // revokeConsent
  // -------------------------------------------------------------------------

  describe('revokeConsent', () => {
    it('delegates to repository.revoke', async () => {
      const revokedRow = makeConsentRow({ status: 'inactive' })
      mockRepo.revoke.mockResolvedValue(revokedRow)

      const result = await service.revokeConsent('consent-1', 'tenant-1')

      expect(result).toEqual(revokedRow)
      expect(mockRepo.revoke).toHaveBeenCalledWith('consent-1', 'tenant-1')
    })

    it('returns null when consent not found', async () => {
      mockRepo.revoke.mockResolvedValue(null)

      const result = await service.revokeConsent('nonexistent', 'tenant-1')

      expect(result).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // getActiveConsent
  // -------------------------------------------------------------------------

  describe('getActiveConsent', () => {
    it('delegates to repository.getActiveByPatient', async () => {
      const row = makeConsentRow()
      mockRepo.getActiveByPatient.mockResolvedValue(row)

      const result = await service.getActiveConsent('patient-1', 'tenant-1')

      expect(result).toEqual(row)
      expect(mockRepo.getActiveByPatient).toHaveBeenCalledWith(
        'patient-1',
        'tenant-1',
      )
    })

    it('returns null when no active consent exists', async () => {
      mockRepo.getActiveByPatient.mockResolvedValue(null)

      const result = await service.getActiveConsent('patient-1', 'tenant-1')

      expect(result).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // buildReason (indirectly tested through verifyConsent)
  // -------------------------------------------------------------------------

  describe('reason strings', () => {
    it('returns "Consent verified" when all checks pass', async () => {
      mockSqlResult(true)
      mockRepo.getActiveByPatient.mockResolvedValue(makeConsentRow())

      const result = await service.verifyConsent('p1', 't1', 'minimal')

      expect(result.reason).toBe('Consent verified')
    })

    it('returns "Consent has expired" when consent is expired', async () => {
      mockSqlResult(true)
      mockRepo.getActiveByPatient.mockResolvedValue(
        makeConsentRow({ period_end: '2020-01-01' }),
      )

      const result = await service.verifyConsent('p1', 't1', 'minimal')

      expect(result.reason).toBe('Consent has expired')
    })

    it('returns "Patient does not have sufficient consent" when SQL check fails', async () => {
      mockSqlResult(false)
      mockRepo.getActiveByPatient.mockResolvedValue(makeConsentRow())

      const result = await service.verifyConsent('p1', 't1', 'full')

      expect(result.reason).toBe('Patient does not have sufficient consent')
    })

    it('returns "State-specific consent requirements not met" when state rules fail', async () => {
      mockSqlResult(true)
      mockRepo.getActiveByPatient.mockResolvedValue(
        makeConsentRow({ consent_level: 'minimal' }),
      )

      const result = await service.verifyConsent(
        'p1',
        't1',
        'minimal',
        'CA',
        'mental_health',
      )

      expect(result.reason).toBe('State-specific consent requirements not met')
    })
  })
})
