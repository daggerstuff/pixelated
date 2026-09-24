/**
 * Tests for EHR Native State Consent Rules Engine (F3.3)
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

import type { ConsentLevel } from '@/lib/research/types/research-types'

import { stateConsentRulesCache } from './cache'
import {
  StateConsentRulesEngine,
  SPECIAL_TREATMENT_CATEGORIES,
  type PatientConsentContext,
  type ConsentEngineResult,
} from './engine'
import {
  clearStateRules,
  registerStateRules,
  DEFAULT_STATE_RULES,
} from './index'
import type { StateConsentRuleRecord, StateRuleConfig } from './schemas'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockRuleConfig: StateRuleConfig = {
  minimumConsentLevel: 'minimal',
  requiresMentalHealthConsent: true,
  requiresSUDConsent: true,
  requiresMinorParentalConsent: true,
  ageOfMajority: 18,
}

const mockTenantRuleConfig: StateRuleConfig = {
  minimumConsentLevel: 'limited',
  requiresMentalHealthConsent: true,
  requiresSUDConsent: false,
  requiresMinorParentalConsent: false,
  ageOfMajority: 19,
}

const mockRuleRecord: StateConsentRuleRecord = {
  ruleId: '550e8400-e29b-41d4-a716-446655440000',
  tenantId: null,
  stateCode: 'CA',
  version: 1,
  status: 'active',
  ruleConfig: mockRuleConfig,
  createdBy: '550e8400-e29b-41d4-a716-446655440001',
  createdByRole: 'complianceOfficer',
  reviewedBy: '550e8400-e29b-41d4-a716-446655440002',
  reviewedByRole: 'healthInformationManager',
  reviewedAt: '2025-01-15T00:00:00.000Z',
  approvedBy: '550e8400-e29b-41d4-a716-446655440003',
  approvedByRole: 'complianceOfficer',
  approvedAt: '2025-01-16T00:00:00.000Z',
  activatedAt: '2025-01-17T00:00:00.000Z',
  supersededBy: null,
  effectiveDate: '2025-01-17',
  expiryDate: null,
  notes: 'Test rule',
  createdAt: '2025-01-14T00:00:00.000Z',
  updatedAt: '2025-01-17T00:00:00.000Z',
}

const mockTenantRuleRecord: StateConsentRuleRecord = {
  ...mockRuleRecord,
  ruleId: '550e8400-e29b-41d4-a716-446655440010',
  tenantId: '550e8400-e29b-41d4-a716-446655440099',
  stateCode: 'CA',
  ruleConfig: mockTenantRuleConfig,
}

// ---------------------------------------------------------------------------
// Mock cache
// ---------------------------------------------------------------------------

vi.mock('./cache', () => ({
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('F3.3 StateConsentRulesEngine', () => {
  let engine: StateConsentRulesEngine

  beforeEach(() => {
    clearStateRules()
    engine = new StateConsentRulesEngine()
    // Reset cache mock
    vi.mocked(stateConsentRulesCache.getActiveRule).mockResolvedValue(null)
  })

  // -------------------------------------------------------------------------
  // SPECIAL_TREATMENT_CATEGORIES
  // -------------------------------------------------------------------------

  describe('SPECIAL_TREATMENT_CATEGORIES', () => {
    it('defines expected treatment categories', () => {
      expect(SPECIAL_TREATMENT_CATEGORIES.mentalHealth).toBe('mental_health')
      expect(SPECIAL_TREATMENT_CATEGORIES.substanceUseDisorder).toBe(
        'substance_use_disorder',
      )
      expect(SPECIAL_TREATMENT_CATEGORIES.reproductiveHealth).toBe(
        'reproductive_health',
      )
      expect(SPECIAL_TREATMENT_CATEGORIES.sexualHealth).toBe('sexual_health')
      expect(SPECIAL_TREATMENT_CATEGORIES.prenatalCare).toBe('prenatal_care')
    })
  })

  // -------------------------------------------------------------------------
  // evaluateConsent — fallback to default rules
  // -------------------------------------------------------------------------

  describe('evaluateConsent with no active rule (fallback)', () => {
    it('uses default rules when no stateCode provided', async () => {
      const context: PatientConsentContext = {}
      const result = await engine.evaluateConsent('full', 'minimal', context)

      expect(result.verified).toBe(true)
      expect(result.ruleSource).toBe('default')
      expect(result.evaluatedStateCode).toBeNull()
      expect(result.stateRules.minimumConsentLevel).toBe(
        DEFAULT_STATE_RULES.minimumConsentLevel,
      )
    })

    it('uses default rules when stateCode has no versioned rule', async () => {
      const context: PatientConsentContext = { stateCode: 'ZZ' }
      // ZZ is not a valid US state, but the engine should still fall back
      const result = await engine.evaluateConsent('full', 'minimal', context)

      expect(result.ruleSource).toBe('default')
      expect(result.evaluatedStateCode).toBe('ZZ')
    })

    it('falls back to Phase 1 registry when registered', async () => {
      const customRules = {
        minimumConsentLevel: 'full' as ConsentLevel,
        requiresMentalHealthConsent: false,
        requiresSUDConsent: false,
        requiresMinorParentalConsent: false,
        ageOfMajority: 21,
      }
      registerStateRules('CA', customRules)

      const context: PatientConsentContext = { stateCode: 'CA' }
      const result = await engine.evaluateConsent('full', 'minimal', context)

      expect(result.ruleSource).toBe('default')
      expect(result.stateRules.minimumConsentLevel).toBe('full')
    })
  })

  // -------------------------------------------------------------------------
  // evaluateConsent — with active versioned rule
  // -------------------------------------------------------------------------

  describe('evaluateConsent with active rule', () => {
    it('uses global rule when available', async () => {
      vi.mocked(stateConsentRulesCache.getActiveRule).mockResolvedValue(
        mockRuleRecord,
      )

      const context: PatientConsentContext = { stateCode: 'CA' }
      const result = await engine.evaluateConsent('full', 'minimal', context)

      expect(result.ruleSource).toBe('global')
      expect(result.evaluatedStateCode).toBe('CA')
      expect(result.stateRules.minimumConsentLevel).toBe('minimal')
    })

    it('uses tenant-specific rule when available', async () => {
      vi.mocked(stateConsentRulesCache.getActiveRule).mockResolvedValue(
        mockTenantRuleRecord,
      )

      const context: PatientConsentContext = {
        stateCode: 'CA',
        tenantId: '550e8400-e29b-41d4-a716-446655440099',
      }
      const result = await engine.evaluateConsent('full', 'minimal', context)

      expect(result.ruleSource).toBe('tenant')
      expect(result.stateRules.minimumConsentLevel).toBe('limited')
    })

    it('elevates required consent when state minimum is higher', async () => {
      vi.mocked(stateConsentRulesCache.getActiveRule).mockResolvedValue(
        mockTenantRuleRecord,
      )

      const context: PatientConsentContext = {
        stateCode: 'CA',
        tenantId: 'tenant-1',
      }
      // Tenant rule requires 'limited', patient has 'minimal', required is 'minimal'
      const result = await engine.evaluateConsent('minimal', 'minimal', context)

      expect(result.verified).toBe(false)
      expect(result.reason).toContain('Insufficient consent')
    })

    it('verifies when patient consent meets elevated requirement', async () => {
      vi.mocked(stateConsentRulesCache.getActiveRule).mockResolvedValue(
        mockTenantRuleRecord,
      )

      const context: PatientConsentContext = {
        stateCode: 'CA',
        tenantId: 'tenant-1',
      }
      // Patient has 'full', required is 'minimal', but tenant requires 'limited'
      const result = await engine.evaluateConsent('full', 'minimal', context)

      expect(result.verified).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // evaluateConsent — treatment category checks
  // -------------------------------------------------------------------------

  describe('evaluateConsent treatment categories', () => {
    it('blocks mental health treatment when consent below limited and requiresMentalHealthConsent is true', async () => {
      vi.mocked(stateConsentRulesCache.getActiveRule).mockResolvedValue(
        mockRuleRecord,
      )

      const context: PatientConsentContext = {
        stateCode: 'CA',
        treatmentCategory: SPECIAL_TREATMENT_CATEGORIES.mentalHealth,
      }
      const result = await engine.evaluateConsent('minimal', 'minimal', context)

      expect(result.verified).toBe(false)
      expect(result.reason).toContain(
        'Mental health treatment requires limited consent or higher',
      )
    })

    it('blocks SUD treatment when consent below limited and requiresSUDConsent is true', async () => {
      vi.mocked(stateConsentRulesCache.getActiveRule).mockResolvedValue(
        mockRuleRecord,
      )

      const context: PatientConsentContext = {
        stateCode: 'CA',
        treatmentCategory: SPECIAL_TREATMENT_CATEGORIES.substanceUseDisorder,
      }
      const result = await engine.evaluateConsent('minimal', 'minimal', context)

      expect(result.verified).toBe(false)
      expect(result.reason).toContain(
        'Substance use disorder treatment requires limited consent or higher',
      )
    })

    it('passes SUD check when requiresSUDConsent is false', async () => {
      vi.mocked(stateConsentRulesCache.getActiveRule).mockResolvedValue(
        mockTenantRuleRecord,
      )

      const context: PatientConsentContext = {
        stateCode: 'CA',
        treatmentCategory: SPECIAL_TREATMENT_CATEGORIES.substanceUseDisorder,
      }
      const result = await engine.evaluateConsent('full', 'minimal', context)

      expect(result.verified).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // evaluateConsent — minor parental consent
  // -------------------------------------------------------------------------

  describe('evaluateConsent minor consent', () => {
    it('blocks minors when requiresMinorParentalConsent is true', async () => {
      vi.mocked(stateConsentRulesCache.getActiveRule).mockResolvedValue(
        mockRuleRecord,
      )

      const context: PatientConsentContext = {
        stateCode: 'CA',
        age: 16,
      }
      const result = await engine.evaluateConsent('full', 'minimal', context)

      expect(result.verified).toBe(false)
      expect(result.reason).toContain('Patient is a minor')
    })

    it('passes for adults at ageOfMajority', async () => {
      vi.mocked(stateConsentRulesCache.getActiveRule).mockResolvedValue(
        mockRuleRecord,
      )

      const context: PatientConsentContext = {
        stateCode: 'CA',
        age: 18,
      }
      const result = await engine.evaluateConsent('full', 'minimal', context)

      expect(result.verified).toBe(true)
    })

    it('passes for minors with exempt treatment category', async () => {
      const exemptRuleRecord: StateConsentRuleRecord = {
        ...mockRuleRecord,
        ruleConfig: {
          ...mockRuleConfig,
          minorConsentCategories: ['reproductive_health'],
        },
      }
      vi.mocked(stateConsentRulesCache.getActiveRule).mockResolvedValue(
        exemptRuleRecord,
      )

      const context: PatientConsentContext = {
        stateCode: 'CA',
        age: 16,
        treatmentCategory: 'reproductive_health',
      }
      const result = await engine.evaluateConsent('full', 'minimal', context)

      expect(result.verified).toBe(true)
    })

    it('passes when requiresMinorParentalConsent is false', async () => {
      vi.mocked(stateConsentRulesCache.getActiveRule).mockResolvedValue(
        mockTenantRuleRecord,
      )

      const context: PatientConsentContext = {
        stateCode: 'CA',
        age: 16,
      }
      const result = await engine.evaluateConsent('full', 'minimal', context)

      expect(result.verified).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // evaluateConsent — treatment category overrides
  // -------------------------------------------------------------------------

  describe('evaluateConsent treatment category overrides', () => {
    it('applies treatment category override minimum', async () => {
      const overrideRecord: StateConsentRuleRecord = {
        ...mockRuleRecord,
        ruleConfig: {
          ...mockRuleConfig,
          treatmentCategoryOverrides: {
            mental_health: {
              minimumConsentLevel: 'full',
            },
          },
        },
      }
      vi.mocked(stateConsentRulesCache.getActiveRule).mockResolvedValue(
        overrideRecord,
      )

      const context: PatientConsentContext = {
        stateCode: 'CA',
        treatmentCategory: 'mental_health',
      }
      // Mental health override requires 'full', but MH check will block first
      const result = await engine.evaluateConsent('limited', 'minimal', context)

      expect(result.verified).toBe(false)
    })

    it('applies treatment category override for non-MH categories', async () => {
      const overrideRecord: StateConsentRuleRecord = {
        ...mockRuleRecord,
        ruleConfig: {
          ...mockRuleConfig,
          requiresMentalHealthConsent: false,
          requiresSUDConsent: false,
          treatmentCategoryOverrides: {
            reproductive_health: {
              minimumConsentLevel: 'full',
            },
          },
        },
      }
      vi.mocked(stateConsentRulesCache.getActiveRule).mockResolvedValue(
        overrideRecord,
      )

      const context: PatientConsentContext = {
        stateCode: 'CA',
        treatmentCategory: 'reproductive_health',
      }
      const result = await engine.evaluateConsent('limited', 'minimal', context)

      expect(result.verified).toBe(false)
      expect(result.reason).toContain('Insufficient consent')
    })
  })

  // -------------------------------------------------------------------------
  // evaluateConsent — provider type restrictions
  // -------------------------------------------------------------------------

  describe('evaluateConsent provider type restrictions', () => {
    it('applies provider type restriction', async () => {
      const restrictedRecord: StateConsentRuleRecord = {
        ...mockRuleRecord,
        ruleConfig: {
          ...mockRuleConfig,
          requiresMentalHealthConsent: false,
          requiresSUDConsent: false,
          requiresMinorParentalConsent: false,
          providerTypeRestrictions: {
            nurse: 'full',
          },
        },
      }
      vi.mocked(stateConsentRulesCache.getActiveRule).mockResolvedValue(
        restrictedRecord,
      )

      const context: PatientConsentContext = {
        stateCode: 'CA',
        providerType: 'nurse',
      }
      // Nurse requires 'full', patient has 'limited'
      const result = await engine.evaluateConsent('limited', 'minimal', context)

      expect(result.verified).toBe(false)
      expect(result.reason).toContain('Insufficient consent')
    })

    it('passes when provider restriction is met', async () => {
      const restrictedRecord: StateConsentRuleRecord = {
        ...mockRuleRecord,
        ruleConfig: {
          ...mockRuleConfig,
          requiresMentalHealthConsent: false,
          requiresSUDConsent: false,
          requiresMinorParentalConsent: false,
          providerTypeRestrictions: {
            nurse: 'limited',
          },
        },
      }
      vi.mocked(stateConsentRulesCache.getActiveRule).mockResolvedValue(
        restrictedRecord,
      )

      const context: PatientConsentContext = {
        stateCode: 'CA',
        providerType: 'nurse',
      }
      const result = await engine.evaluateConsent('limited', 'minimal', context)

      expect(result.verified).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // evaluateConsent — insufficient base consent
  // -------------------------------------------------------------------------

  describe('evaluateConsent insufficient consent', () => {
    it('fails when actual consent is below required', async () => {
      const context: PatientConsentContext = {}
      const result = await engine.evaluateConsent('none', 'full', context)

      expect(result.verified).toBe(false)
      expect(result.reason).toContain('Insufficient consent')
    })

    it('fails when actual is minimal but full is required', async () => {
      const context: PatientConsentContext = {}
      const result = await engine.evaluateConsent('minimal', 'full', context)

      expect(result.verified).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // getEffectiveRequiredLevel
  // -------------------------------------------------------------------------

  describe('getEffectiveRequiredLevel', () => {
    it('returns required level when no state rule exists', async () => {
      const context: PatientConsentContext = {}
      const result = await engine.getEffectiveRequiredLevel('minimal', context)

      expect(result).toBe('minimal')
    })

    it('elevates to state minimum when higher', async () => {
      vi.mocked(stateConsentRulesCache.getActiveRule).mockResolvedValue(
        mockTenantRuleRecord,
      )

      const context: PatientConsentContext = {
        stateCode: 'CA',
        tenantId: 'tenant-1',
      }
      const result = await engine.getEffectiveRequiredLevel('minimal', context)

      expect(result).toBe('limited')
    })

    it('applies override consent level', async () => {
      const overrideRecord: StateConsentRuleRecord = {
        ...mockRuleRecord,
        ruleConfig: {
          ...mockRuleConfig,
          overrideConsentLevel: 'full',
        },
      }
      vi.mocked(stateConsentRulesCache.getActiveRule).mockResolvedValue(
        overrideRecord,
      )

      const context: PatientConsentContext = { stateCode: 'CA' }
      const result = await engine.getEffectiveRequiredLevel('minimal', context)

      expect(result).toBe('full')
    })
  })
})
