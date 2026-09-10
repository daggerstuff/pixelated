/**
 * Tests for EHR Native State Consent Rules seed data (G3.1 Legal Review Framework)
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'

import { US_STATE_CODE_LIST } from './schemas'
import {
  STATE_RULE_SEEDS,
  SEED_JURISDICTION_COUNT,
  getSeedForState,
  getAllSeeds,
  validateSeedCompleteness,
  type StateRuleSeed,
} from './seed-data'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('G3.1 seed data', () => {
  describe('completeness', () => {
    it('covers every US_STATE_CODE', () => {
      for (const code of US_STATE_CODE_LIST) {
        expect(STATE_RULE_SEEDS[code], `seed for ${code}`).toBeDefined()
      }
    })

    it('SEED_JURISDICTION_COUNT equals US_STATE_CODE_LIST length', () => {
      expect(SEED_JURISDICTION_COUNT).toBe(US_STATE_CODE_LIST.length)
    })

    it('getAllSeeds returns one seed per jurisdiction', () => {
      const all = getAllSeeds()
      expect(all).toHaveLength(US_STATE_CODE_LIST.length)
    })

    it('validateSeedCompleteness does not throw', () => {
      expect(() => validateSeedCompleteness()).not.toThrow()
    })
  })

  describe('getSeedForState', () => {
    it('returns the seed for a valid state code', () => {
      const ca = getSeedForState('CA')
      expect(ca).toBeDefined()
      expect(ca?.stateCode).toBe('CA')
      expect(ca?.stateName).toBe('California')
    })

    it('returns undefined for an invalid state code', () => {
      expect(getSeedForState('XX')).toBeUndefined()
    })

    it('returns undefined for lowercase input (no normalization)', () => {
      expect(getSeedForState('ca')).toBeUndefined()
    })
  })

  describe('seed structure', () => {
    it('every seed has a non-empty stateName', () => {
      for (const seed of getAllSeeds()) {
        expect(seed.stateName.length).toBeGreaterThan(0)
      }
    })

    it('every seed has a non-empty legalReference', () => {
      for (const seed of getAllSeeds()) {
        expect(seed.legalReference.length).toBeGreaterThan(0)
      }
    })

    it('every seed has a valid lastReviewed date string', () => {
      for (const seed of getAllSeeds()) {
        expect(seed.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    })

    it('every seed ruleConfig has minimumConsentLevel', () => {
      for (const seed of getAllSeeds()) {
        expect(seed.ruleConfig.minimumConsentLevel).toMatch(
          /^(none|minimal|limited|full)$/,
        )
      }
    })

    it('every seed ruleConfig has ageOfMajority between 16 and 21', () => {
      for (const seed of getAllSeeds()) {
        expect(seed.ruleConfig.ageOfMajority).toBeGreaterThanOrEqual(16)
        expect(seed.ruleConfig.ageOfMajority).toBeLessThanOrEqual(21)
      }
    })

    it('every seed ruleConfig has boolean consent flags', () => {
      for (const seed of getAllSeeds()) {
        expect(typeof seed.ruleConfig.requiresMentalHealthConsent).toBe(
          'boolean',
        )
        expect(typeof seed.ruleConfig.requiresSUDConsent).toBe('boolean')
        expect(typeof seed.ruleConfig.requiresMinorParentalConsent).toBe(
          'boolean',
        )
      }
    })

    it('sourceUrl when present is a valid URL', () => {
      for (const seed of getAllSeeds()) {
        if (seed.sourceUrl) {
          expect(() => new URL(seed.sourceUrl!)).not.toThrow()
        }
      }
    })
  })

  describe('state-specific values', () => {
    it('California uses limited minimum consent', () => {
      expect(getSeedForState('CA')?.ruleConfig.minimumConsentLevel).toBe(
        'limited',
      )
    })

    it('New York uses limited minimum consent', () => {
      expect(getSeedForState('NY')?.ruleConfig.minimumConsentLevel).toBe(
        'limited',
      )
    })

    it('Alabama age of majority is 19', () => {
      expect(getSeedForState('AL')?.ruleConfig.ageOfMajority).toBe(19)
    })

    it('Nebraska age of majority is 19', () => {
      expect(getSeedForState('NE')?.ruleConfig.ageOfMajority).toBe(19)
    })

    it('Mississippi age of majority is 21', () => {
      expect(getSeedForState('MS')?.ruleConfig.ageOfMajority).toBe(21)
    })

    it('Puerto Rico age of majority is 21', () => {
      expect(getSeedForState('PR')?.ruleConfig.ageOfMajority).toBe(21)
    })

    it('most states have age of majority 18', () => {
      const eighteen = getAllSeeds().filter(
        (s) => s.ruleConfig.ageOfMajority === 18,
      )
      // At least 45 of 56 jurisdictions should be 18
      expect(eighteen.length).toBeGreaterThanOrEqual(45)
    })
  })

  describe('territories', () => {
    it('includes DC', () => {
      expect(getSeedForState('DC')).toBeDefined()
    })

    it('includes Puerto Rico', () => {
      expect(getSeedForState('PR')).toBeDefined()
    })

    it('includes Guam', () => {
      expect(getSeedForState('GU')).toBeDefined()
    })

    it('includes US Virgin Islands', () => {
      expect(getSeedForState('VI')).toBeDefined()
    })

    it('includes American Samoa', () => {
      expect(getSeedForState('AS')).toBeDefined()
    })

    it('includes Northern Mariana Islands', () => {
      expect(getSeedForState('MP')).toBeDefined()
    })
  })
})
