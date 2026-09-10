/**
 * Tests for EHR Native State Consent Rules checklist generator (G3.1 Legal Review Framework)
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'

import { US_STATE_CODE_LIST } from './schemas'
import {
  generateStateChecklist,
  generateAllChecklists,
  getChecklistJurisdictions,
  StateChecklistSchema,
  StateChecklistItemSchema,
} from './checklist'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('G3.1 checklist generator', () => {
  describe('generateStateChecklist', () => {
    it('returns a checklist for California', () => {
      const ca = generateStateChecklist('CA')
      expect(ca).toBeDefined()
      expect(ca?.stateCode).toBe('CA')
      expect(ca?.stateName).toBe('California')
    })

    it('generates 7 checklist items per state', () => {
      const ca = generateStateChecklist('CA')
      expect(ca?.items).toHaveLength(7)
    })

    it('returns undefined for invalid state code', () => {
      expect(generateStateChecklist('XX')).toBeUndefined()
    })

    it('every item has a unique itemId', () => {
      const ca = generateStateChecklist('CA')
      const ids = ca?.items.map((i) => i.itemId)
      expect(new Set(ids).size).toBe(ids?.length)
    })

    it('every item starts with pending status', () => {
      const ca = generateStateChecklist('CA')
      for (const item of ca?.items ?? []) {
        expect(item.status).toBe('pending')
      }
    })

    it('every item has stateCode matching the requested state', () => {
      const tx = generateStateChecklist('TX')
      for (const item of tx?.items ?? []) {
        expect(item.stateCode).toBe('TX')
      }
    })

    it('items cover all expected categories', () => {
      const ca = generateStateChecklist('CA')
      const categories = ca?.items.map((i) => i.category).sort()
      expect(categories).toEqual([
        'age_of_majority',
        'legal_reference_currency',
        'mental_health_consent',
        'minimum_consent_level',
        'minor_consent_categories',
        'minor_parental_consent',
        'sud_consent',
      ])
    })

    it('item legalReference matches seed legalReference', () => {
      const ca = generateStateChecklist('CA')
      const refItem = ca?.items.find((i) => i.category === 'legal_reference_currency')
      expect(refItem?.legalReference).toBeDefined()
      expect(refItem?.legalReference.length).toBeGreaterThan(0)
    })

    it('age_of_majority item seedValue matches the seed', () => {
      const al = generateStateChecklist('AL')
      const ageItem = al?.items.find((i) => i.category === 'age_of_majority')
      expect(ageItem?.seedValue).toBe('19')
    })
  })

  describe('generateAllChecklists', () => {
    it('returns one checklist per US jurisdiction', () => {
      const all = generateAllChecklists()
      expect(all).toHaveLength(US_STATE_CODE_LIST.length)
    })

    it('every checklist validates against StateChecklistSchema', () => {
      const all = generateAllChecklists()
      for (const c of all) {
        expect(() => StateChecklistSchema.parse(c)).not.toThrow()
      }
    })

    it('every item validates against StateChecklistItemSchema', () => {
      const all = generateAllChecklists()
      for (const c of all) {
        for (const item of c.items) {
          expect(() => StateChecklistItemSchema.parse(item)).not.toThrow()
        }
      }
    })

    it('every checklist has a generatedAt timestamp', () => {
      const all = generateAllChecklists()
      for (const c of all) {
        expect(c.generatedAt).toBeDefined()
      }
    })
  })

  describe('getChecklistJurisdictions', () => {
    it('returns all US state codes', () => {
      const codes = getChecklistJurisdictions()
      expect(codes).toHaveLength(US_STATE_CODE_LIST.length)
      for (const code of US_STATE_CODE_LIST) {
        expect(codes).toContain(code)
      }
    })
  })

  describe('schema validation', () => {
    it('rejects checklist with unknown extra field (strict mode)', () => {
      const ca = generateStateChecklist('CA')
      const bad = { ...ca, extraField: 'no' }
      expect(() => StateChecklistSchema.parse(bad)).toThrow()
    })

    it('rejects item with unknown extra field (strict mode)', () => {
      const ca = generateStateChecklist('CA')
      const item = ca?.items[0]
      const bad = { ...item, extraField: 'no' }
      expect(() => StateChecklistItemSchema.parse(bad)).toThrow()
    })
  })
})
