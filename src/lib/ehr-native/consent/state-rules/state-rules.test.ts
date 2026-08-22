/**
 * Tests for EHR Native Consent State Rules (F1.4)
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import type { ConsentLevel } from '@/lib/research/types/research-types'

import {
  CONSENT_ORDER,
  DEFAULT_STATE_RULES,
  getStateRules,
  registerStateRules,
  clearStateRules,
  requiresHigherConsent,
  type StateConsentRules,
} from './index'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('consent state-rules', () => {
  beforeEach(() => {
    clearStateRules()
  })

  afterEach(() => {
    clearStateRules()
  })

  // -------------------------------------------------------------------------
  // CONSENT_ORDER
  // -------------------------------------------------------------------------

  describe('CONSENT_ORDER', () => {
    it('ranks consent levels in ascending order', () => {
      expect(CONSENT_ORDER.none).toBe(0)
      expect(CONSENT_ORDER.minimal).toBe(1)
      expect(CONSENT_ORDER.limited).toBe(2)
      expect(CONSENT_ORDER.full).toBe(3)
    })

    it('maintains strict monotonic ordering', () => {
      expect(CONSENT_ORDER.none).toBeLessThan(CONSENT_ORDER.minimal)
      expect(CONSENT_ORDER.minimal).toBeLessThan(CONSENT_ORDER.limited)
      expect(CONSENT_ORDER.limited).toBeLessThan(CONSENT_ORDER.full)
    })
  })

  // -------------------------------------------------------------------------
  // requiresHigherConsent
  // -------------------------------------------------------------------------

  describe('requiresHigherConsent', () => {
    it('returns true when actual meets the required level', () => {
      expect(requiresHigherConsent('minimal', 'minimal')).toBe(true)
      expect(requiresHigherConsent('limited', 'minimal')).toBe(true)
      expect(requiresHigherConsent('full', 'minimal')).toBe(true)
    })

    it('returns false when actual is below the required level', () => {
      expect(requiresHigherConsent('none', 'minimal')).toBe(false)
      expect(requiresHigherConsent('minimal', 'limited')).toBe(false)
      expect(requiresHigherConsent('limited', 'full')).toBe(false)
    })

    it('returns true when both are none', () => {
      expect(requiresHigherConsent('none', 'none')).toBe(true)
    })

    it('returns true when actual exceeds required', () => {
      expect(requiresHigherConsent('full', 'none')).toBe(true)
      expect(requiresHigherConsent('full', 'limited')).toBe(true)
    })

    it('handles all ConsentLevel combinations exhaustively', () => {
      const levels: ConsentLevel[] = ['none', 'minimal', 'limited', 'full']
      for (const actual of levels) {
        for (const required of levels) {
          const result = requiresHigherConsent(actual, required)
          expect(result).toBe(CONSENT_ORDER[actual] >= CONSENT_ORDER[required])
        }
      }
    })
  })

  // -------------------------------------------------------------------------
  // DEFAULT_STATE_RULES
  // -------------------------------------------------------------------------

  describe('DEFAULT_STATE_RULES', () => {
    it('has the expected default minimumConsentLevel', () => {
      expect(DEFAULT_STATE_RULES.minimumConsentLevel).toBe('minimal')
    })

    it('requires mental health consent by default', () => {
      expect(DEFAULT_STATE_RULES.requiresMentalHealthConsent).toBe(true)
    })

    it('requires SUD consent by default', () => {
      expect(DEFAULT_STATE_RULES.requiresSUDConsent).toBe(true)
    })

    it('requires minor parental consent by default', () => {
      expect(DEFAULT_STATE_RULES.requiresMinorParentalConsent).toBe(true)
    })

    it('uses 18 as the age of majority by default', () => {
      expect(DEFAULT_STATE_RULES.ageOfMajority).toBe(18)
    })

    it('does not have an overrideConsentLevel by default', () => {
      expect(DEFAULT_STATE_RULES.overrideConsentLevel).toBeUndefined()
    })

    it('does not have a validateConsent callback by default', () => {
      expect(DEFAULT_STATE_RULES.validateConsent).toBeUndefined()
    })

    it('is a readonly object (all properties are readonly)', () => {
      // Type-level check: we can't assert readonly at runtime, but verify
      // the shape matches the interface
      const rules: StateConsentRules = DEFAULT_STATE_RULES
      expect(rules.minimumConsentLevel).toBeDefined()
    })
  })

  // -------------------------------------------------------------------------
  // getStateRules
  // -------------------------------------------------------------------------

  describe('getStateRules', () => {
    it('returns DEFAULT_STATE_RULES when no stateCode is provided', () => {
      expect(getStateRules()).toBe(DEFAULT_STATE_RULES)
    })

    it('returns DEFAULT_STATE_RULES when stateCode is undefined', () => {
      expect(getStateRules(undefined)).toBe(DEFAULT_STATE_RULES)
    })

    it('returns DEFAULT_STATE_RULES for an unregistered state', () => {
      expect(getStateRules('ZZ')).toBe(DEFAULT_STATE_RULES)
    })

    it('returns registered rules for a specific state', () => {
      const caRules: StateConsentRules = {
        ...DEFAULT_STATE_RULES,
        minimumConsentLevel: 'limited',
        ageOfMajority: 18,
      }
      registerStateRules('CA', caRules)
      expect(getStateRules('CA')).toBe(caRules)
    })

    it('normalizes stateCode to uppercase (case-insensitive lookup)', () => {
      const txRules: StateConsentRules = {
        ...DEFAULT_STATE_RULES,
        minimumConsentLevel: 'full',
      }
      registerStateRules('TX', txRules)
      expect(getStateRules('tx')).toBe(txRules)
      expect(getStateRules('Tx')).toBe(txRules)
      expect(getStateRules('TX')).toBe(txRules)
    })

    it('returns different rules for different states', () => {
      const caRules: StateConsentRules = {
        ...DEFAULT_STATE_RULES,
        minimumConsentLevel: 'limited',
      }
      const nyRules: StateConsentRules = {
        ...DEFAULT_STATE_RULES,
        minimumConsentLevel: 'full',
        ageOfMajority: 21,
      }
      registerStateRules('CA', caRules)
      registerStateRules('NY', nyRules)
      expect(getStateRules('CA')).toBe(caRules)
      expect(getStateRules('NY')).toBe(nyRules)
      expect(getStateRules('FL')).toBe(DEFAULT_STATE_RULES)
    })
  })

  // -------------------------------------------------------------------------
  // registerStateRules
  // -------------------------------------------------------------------------

  describe('registerStateRules', () => {
    it('registers rules for a new state', () => {
      const customRules: StateConsentRules = {
        ...DEFAULT_STATE_RULES,
        minimumConsentLevel: 'full',
      }
      registerStateRules('WA', customRules)
      expect(getStateRules('WA')).toBe(customRules)
    })

    it('overwrites existing rules for the same state', () => {
      const v1: StateConsentRules = {
        ...DEFAULT_STATE_RULES,
        minimumConsentLevel: 'minimal',
      }
      const v2: StateConsentRules = {
        ...DEFAULT_STATE_RULES,
        minimumConsentLevel: 'full',
      }
      registerStateRules('OR', v1)
      expect(getStateRules('OR')).toBe(v1)
      registerStateRules('OR', v2)
      expect(getStateRules('OR')).toBe(v2)
    })

    it('normalizes stateCode to uppercase when registering', () => {
      const rules: StateConsentRules = {
        ...DEFAULT_STATE_RULES,
        minimumConsentLevel: 'limited',
      }
      registerStateRules('nv', rules)
      expect(getStateRules('NV')).toBe(rules)
      expect(getStateRules('nv')).toBe(rules)
    })
  })

  // -------------------------------------------------------------------------
  // clearStateRules
  // -------------------------------------------------------------------------

  describe('clearStateRules', () => {
    it('clears all registered state rules', () => {
      const caRules: StateConsentRules = {
        ...DEFAULT_STATE_RULES,
        minimumConsentLevel: 'limited',
      }
      const nyRules: StateConsentRules = {
        ...DEFAULT_STATE_RULES,
        minimumConsentLevel: 'full',
      }
      registerStateRules('CA', caRules)
      registerStateRules('NY', nyRules)
      expect(getStateRules('CA')).toBe(caRules)
      expect(getStateRules('NY')).toBe(nyRules)
      clearStateRules()
      expect(getStateRules('CA')).toBe(DEFAULT_STATE_RULES)
      expect(getStateRules('NY')).toBe(DEFAULT_STATE_RULES)
    })

    it('is safe to call when registry is already empty', () => {
      expect(() => clearStateRules()).not.toThrow()
    })

    it('allows re-registration after clearing', () => {
      const rules: StateConsentRules = {
        ...DEFAULT_STATE_RULES,
        minimumConsentLevel: 'full',
      }
      registerStateRules('AZ', rules)
      clearStateRules()
      expect(getStateRules('AZ')).toBe(DEFAULT_STATE_RULES)
      registerStateRules('AZ', rules)
      expect(getStateRules('AZ')).toBe(rules)
    })
  })

  // -------------------------------------------------------------------------
  // StateConsentRules with validateConsent callback
  // -------------------------------------------------------------------------

  describe('validateConsent callback', () => {
    it('allows custom validation logic', () => {
      const validateConsent = vi.fn((patientId, consentLevel, treatmentCategory) => {
        // Reject 'none' consent always, allow 'full' for mental_health
        if (consentLevel === 'none') return false
        if (treatmentCategory === 'mental_health' && consentLevel !== 'full') return false
        return true
      })
      const rules: StateConsentRules = {
        ...DEFAULT_STATE_RULES,
        validateConsent,
      }
      registerStateRules('CA', rules)
      expect(getStateRules('CA').validateConsent).toBe(validateConsent)
    })
  })
})
