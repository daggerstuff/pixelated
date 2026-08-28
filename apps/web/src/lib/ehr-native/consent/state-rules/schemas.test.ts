/**
 * Tests for EHR Native State Consent Rules Zod Schemas (F3.3)
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'

import {
  ConsentLevelSchema,
  RuleStatusSchema,
  AuditActionSchema,
  StateCodeSchema,
  StateRuleConfigSchema,
  CreateStateRuleInputSchema,
  UpdateStateRuleInputSchema,
  ListRulesQuerySchema,
  validateStateRuleConfig,
  safeValidateStateRuleConfig,
  US_STATE_CODE_LIST,
  type StateRuleConfig,
} from './schemas'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const validRuleConfig: StateRuleConfig = {
  minimumConsentLevel: 'minimal',
  requiresMentalHealthConsent: true,
  requiresSUDConsent: true,
  requiresMinorParentalConsent: true,
  ageOfMajority: 18,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('F3.3 schemas', () => {
  // -------------------------------------------------------------------------
  // ConsentLevelSchema
  // -------------------------------------------------------------------------

  describe('ConsentLevelSchema', () => {
    it('accepts all four consent levels', () => {
      expect(ConsentLevelSchema.parse('none')).toBe('none')
      expect(ConsentLevelSchema.parse('minimal')).toBe('minimal')
      expect(ConsentLevelSchema.parse('limited')).toBe('limited')
      expect(ConsentLevelSchema.parse('full')).toBe('full')
    })

    it('rejects invalid consent levels', () => {
      expect(() => ConsentLevelSchema.parse('invalid')).toThrow()
      expect(() => ConsentLevelSchema.parse('NONE')).toThrow()
      expect(() => ConsentLevelSchema.parse('')).toThrow()
    })
  })

  // -------------------------------------------------------------------------
  // RuleStatusSchema
  // -------------------------------------------------------------------------

  describe('RuleStatusSchema', () => {
    it('accepts all workflow statuses', () => {
      const statuses = [
        'draft',
        'review',
        'approved',
        'active',
        'superseded',
        'archived',
      ]
      for (const status of statuses) {
        expect(RuleStatusSchema.parse(status)).toBe(status)
      }
    })

    it('rejects invalid statuses', () => {
      expect(() => RuleStatusSchema.parse('pending')).toThrow()
      expect(() => RuleStatusSchema.parse('published')).toThrow()
    })
  })

  // -------------------------------------------------------------------------
  // AuditActionSchema
  // -------------------------------------------------------------------------

  describe('AuditActionSchema', () => {
    it('accepts all audit actions', () => {
      const actions = [
        'create',
        'update',
        'submit_for_review',
        'approve',
        'activate',
        'supersede',
        'archive',
        'delete',
      ]
      for (const action of actions) {
        expect(AuditActionSchema.parse(action)).toBe(action)
      }
    })

    it('rejects invalid actions', () => {
      expect(() => AuditActionSchema.parse('modify')).toThrow()
      expect(() => AuditActionSchema.parse('submit')).toThrow()
    })
  })

  // -------------------------------------------------------------------------
  // StateCodeSchema
  // -------------------------------------------------------------------------

  describe('StateCodeSchema', () => {
    it('accepts all 50 state codes', () => {
      const stateCodes = [
        'AL',
        'AK',
        'AZ',
        'AR',
        'CA',
        'CO',
        'CT',
        'DE',
        'FL',
        'GA',
        'HI',
        'ID',
        'IL',
        'IN',
        'IA',
        'KS',
        'KY',
        'LA',
        'ME',
        'MD',
        'MA',
        'MI',
        'MN',
        'MS',
        'MO',
        'MT',
        'NE',
        'NV',
        'NH',
        'NJ',
        'NM',
        'NY',
        'NC',
        'ND',
        'OH',
        'OK',
        'OR',
        'PA',
        'RI',
        'SC',
        'SD',
        'TN',
        'TX',
        'UT',
        'VT',
        'VA',
        'WA',
        'WV',
        'WI',
        'WY',
      ]
      for (const code of stateCodes) {
        expect(StateCodeSchema.parse(code)).toBe(code)
      }
    })

    it('accepts DC and territories', () => {
      expect(StateCodeSchema.parse('DC')).toBe('DC')
      expect(StateCodeSchema.parse('PR')).toBe('PR')
      expect(StateCodeSchema.parse('GU')).toBe('GU')
      expect(StateCodeSchema.parse('VI')).toBe('VI')
      expect(StateCodeSchema.parse('AS')).toBe('AS')
      expect(StateCodeSchema.parse('MP')).toBe('MP')
    })

    it('normalizes lowercase to uppercase', () => {
      expect(StateCodeSchema.parse('ca')).toBe('CA')
      expect(StateCodeSchema.parse('ny')).toBe('NY')
      expect(StateCodeSchema.parse('dc')).toBe('DC')
    })

    it('rejects invalid codes', () => {
      expect(() => StateCodeSchema.parse('XX')).toThrow()
      expect(() => StateCodeSchema.parse('USA')).toThrow()
      expect(() => StateCodeSchema.parse('')).toThrow()
      expect(() => StateCodeSchema.parse('C')).toThrow()
      expect(() => StateCodeSchema.parse('CAL')).toThrow()
    })

    it('US_STATE_CODE_LIST contains 56 entries (50 states + DC + 5 territories)', () => {
      expect(US_STATE_CODE_LIST).toHaveLength(56)
    })
  })

  // -------------------------------------------------------------------------
  // StateRuleConfigSchema
  // -------------------------------------------------------------------------

  describe('StateRuleConfigSchema', () => {
    it('accepts a minimal valid config', () => {
      const result = StateRuleConfigSchema.parse(validRuleConfig)
      expect(result.minimumConsentLevel).toBe('minimal')
      expect(result.ageOfMajority).toBe(18)
    })

    it('accepts a full config with all optional fields', () => {
      const fullConfig: StateRuleConfig = {
        ...validRuleConfig,
        overrideConsentLevel: 'full',
        minorConsentCategories: ['reproductive_health', 'mental_health'],
        providerTypeRestrictions: {
          physician: 'full',
          nurse: 'limited',
        },
        treatmentCategoryOverrides: {
          mental_health: {
            minimumConsentLevel: 'limited',
            overrideConsentLevel: 'full',
          },
        },
        legalMetadata: {
          legalReference: '42 CFR Part 2',
          lastLegalReviewDate: '2025-01-15',
          nextReviewDueDate: '2026-01-15',
          reviewedBy: 'Legal Team',
        },
      }
      const result = StateRuleConfigSchema.parse(fullConfig)
      expect(result.overrideConsentLevel).toBe('full')
      expect(result.minorConsentCategories).toHaveLength(2)
      expect(result.legalMetadata?.legalReference).toBe('42 CFR Part 2')
    })

    it('rejects ageOfMajority below 16', () => {
      expect(() =>
        StateRuleConfigSchema.parse({
          ...validRuleConfig,
          ageOfMajority: 15,
        }),
      ).toThrow()
    })

    it('rejects ageOfMajority above 21', () => {
      expect(() =>
        StateRuleConfigSchema.parse({
          ...validRuleConfig,
          ageOfMajority: 22,
        }),
      ).toThrow()
    })

    it('rejects non-integer ageOfMajority', () => {
      expect(() =>
        StateRuleConfigSchema.parse({
          ...validRuleConfig,
          ageOfMajority: 18.5,
        }),
      ).toThrow()
    })

    it('rejects unknown extra fields (strict mode)', () => {
      expect(() =>
        StateRuleConfigSchema.parse({
          ...validRuleConfig,
          extraField: 'not allowed',
        }),
      ).toThrow()
    })

    it('accepts boundary ages 16 and 21', () => {
      expect(
        StateRuleConfigSchema.parse({ ...validRuleConfig, ageOfMajority: 16 })
          .ageOfMajority,
      ).toBe(16)
      expect(
        StateRuleConfigSchema.parse({ ...validRuleConfig, ageOfMajority: 21 })
          .ageOfMajority,
      ).toBe(21)
    })

    it('rejects invalid consent level in overrideConsentLevel', () => {
      expect(() =>
        StateRuleConfigSchema.parse({
          ...validRuleConfig,
          overrideConsentLevel: 'invalid' as never,
        }),
      ).toThrow()
    })

    it('rejects invalid minor consent category', () => {
      expect(() =>
        StateRuleConfigSchema.parse({
          ...validRuleConfig,
          minorConsentCategories: ['invalid_category' as never],
        }),
      ).toThrow()
    })
  })

  // -------------------------------------------------------------------------
  // CreateStateRuleInputSchema
  // -------------------------------------------------------------------------

  describe('CreateStateRuleInputSchema', () => {
    it('accepts a valid create input with tenantId', () => {
      const result = CreateStateRuleInputSchema.parse({
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        stateCode: 'CA',
        ruleConfig: validRuleConfig,
      })
      expect(result.stateCode).toBe('CA')
      expect(result.tenantId).toBe('550e8400-e29b-41d4-a716-446655440000')
    })

    it('accepts a valid create input with null tenantId (global rule)', () => {
      const result = CreateStateRuleInputSchema.parse({
        tenantId: null,
        stateCode: 'NY',
        ruleConfig: validRuleConfig,
      })
      expect(result.tenantId).toBeNull()
    })

    it('accepts a valid create input without tenantId (defaults to undefined)', () => {
      const result = CreateStateRuleInputSchema.parse({
        stateCode: 'TX',
        ruleConfig: validRuleConfig,
      })
      expect(result.tenantId).toBeUndefined()
    })

    it('accepts optional fields', () => {
      const result = CreateStateRuleInputSchema.parse({
        stateCode: 'CA',
        ruleConfig: validRuleConfig,
        effectiveDate: '2025-01-01',
        expiryDate: '2026-01-01',
        notes: 'Initial draft',
      })
      expect(result.effectiveDate).toBe('2025-01-01')
      expect(result.notes).toBe('Initial draft')
    })

    it('rejects invalid state code', () => {
      expect(() =>
        CreateStateRuleInputSchema.parse({
          stateCode: 'XX',
          ruleConfig: validRuleConfig,
        }),
      ).toThrow()
    })

    it('rejects invalid tenantId format', () => {
      expect(() =>
        CreateStateRuleInputSchema.parse({
          tenantId: 'not-a-uuid',
          stateCode: 'CA',
          ruleConfig: validRuleConfig,
        }),
      ).toThrow()
    })

    it('rejects notes exceeding 2000 chars', () => {
      expect(() =>
        CreateStateRuleInputSchema.parse({
          stateCode: 'CA',
          ruleConfig: validRuleConfig,
          notes: 'a'.repeat(2001),
        }),
      ).toThrow()
    })
  })

  // -------------------------------------------------------------------------
  // UpdateStateRuleInputSchema
  // -------------------------------------------------------------------------

  describe('UpdateStateRuleInputSchema', () => {
    it('accepts partial updates', () => {
      const result = UpdateStateRuleInputSchema.parse({
        ruleConfig: validRuleConfig,
      })
      expect(result.ruleConfig?.minimumConsentLevel).toBe('minimal')
    })

    it('accepts nullable fields', () => {
      const result = UpdateStateRuleInputSchema.parse({
        notes: null,
        expiryDate: null,
      })
      expect(result.notes).toBeNull()
      expect(result.expiryDate).toBeNull()
    })

    it('accepts empty object', () => {
      const result = UpdateStateRuleInputSchema.parse({})
      expect(result.ruleConfig).toBeUndefined()
    })
  })

  // -------------------------------------------------------------------------
  // ListRulesQuerySchema
  // -------------------------------------------------------------------------

  describe('ListRulesQuerySchema', () => {
    it('applies defaults for page and limit', () => {
      const result = ListRulesQuerySchema.parse({})
      expect(result.page).toBe(1)
      expect(result.limit).toBe(50)
    })

    it('accepts valid query parameters', () => {
      const result = ListRulesQuerySchema.parse({
        stateCode: 'CA',
        status: 'active',
        page: 2,
        limit: 25,
      })
      expect(result.stateCode).toBe('CA')
      expect(result.status).toBe('active')
      expect(result.page).toBe(2)
      expect(result.limit).toBe(25)
    })

    it('rejects page below 1', () => {
      expect(() => ListRulesQuerySchema.parse({ page: 0 })).toThrow()
    })

    it('rejects limit above 100', () => {
      expect(() => ListRulesQuerySchema.parse({ limit: 101 })).toThrow()
    })

    it('normalizes stateCode to uppercase', () => {
      const result = ListRulesQuerySchema.parse({ stateCode: 'ca' })
      expect(result.stateCode).toBe('CA')
    })
  })

  // -------------------------------------------------------------------------
  // Validation helpers
  // -------------------------------------------------------------------------

  describe('validateStateRuleConfig', () => {
    it('returns parsed config on valid input', () => {
      const result = validateStateRuleConfig(validRuleConfig)
      expect(result.minimumConsentLevel).toBe('minimal')
    })

    it('throws on invalid input', () => {
      expect(() => validateStateRuleConfig({ invalid: true })).toThrow()
    })
  })

  describe('safeValidateStateRuleConfig', () => {
    it('returns success: true with data on valid input', () => {
      const result = safeValidateStateRuleConfig(validRuleConfig)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.minimumConsentLevel).toBe('minimal')
      }
    })

    it('returns success: false with error on invalid input', () => {
      const result = safeValidateStateRuleConfig({ invalid: true })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })
  })
})
