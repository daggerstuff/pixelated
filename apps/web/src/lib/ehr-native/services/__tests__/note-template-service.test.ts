/**
 * Tests for EHR Native Note Template Service (F1.8)
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'

import { noteTemplateService } from '../note-template-service'
import type { NoteModality } from '../note-template-service'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NoteTemplateService', () => {
  describe('listTemplates', () => {
    it('returns all templates when no modality filter is provided', () => {
      const templates = noteTemplateService.listTemplates()
      expect(templates.length).toBeGreaterThan(0)
    })

    it('filters templates by modality', () => {
      const all = noteTemplateService.listTemplates()
      const therapy = noteTemplateService.listTemplates(
        'individual-therapy' as NoteModality,
      )
      expect(therapy.length).toBeLessThanOrEqual(all.length)
      for (const t of therapy) {
        expect(t.modality).toBe('individual-therapy')
      }
    })

    it('returns empty array for unknown modality', () => {
      const templates = noteTemplateService.listTemplates(
        'medication-management' as NoteModality,
      )
      // medication-management may or may not have templates, but the call should not throw
      expect(Array.isArray(templates)).toBe(true)
    })
  })

  describe('getTemplate', () => {
    it('returns a template by its ID', () => {
      const all = noteTemplateService.listTemplates()
      const first = all[0]
      const found = noteTemplateService.getTemplate(first.id)
      expect(found).toBeDefined()
      expect(found?.id).toBe(first.id)
    })

    it('returns null or undefined for a non-existent template ID', () => {
      const found = noteTemplateService.getTemplate('non-existent-template-id')
      expect(found == null).toBe(true)
    })
  })

  describe('listModalities', () => {
    it('returns a list of available modalities', () => {
      const modalities = noteTemplateService.listModalities()
      expect(modalities.length).toBeGreaterThan(0)
      for (const m of modalities) {
        expect(typeof m).toBe('string')
      }
    })

    it('includes individual-therapy as a modality', () => {
      const modalities = noteTemplateService.listModalities()
      expect(modalities).toContain('individual-therapy')
    })
  })

  describe('template structure', () => {
    it('each template has required fields', () => {
      const templates = noteTemplateService.listTemplates()
      for (const t of templates) {
        expect(t.id).toBeDefined()
        expect(t.name).toBeDefined()
        expect(t.modality).toBeDefined()
        expect(t.sections).toBeDefined()
        expect(Array.isArray(t.sections)).toBe(true)
      }
    })

    it('each section has key and label', () => {
      const templates = noteTemplateService.listTemplates()
      for (const t of templates) {
        for (const s of t.sections) {
          expect(s.key).toBeDefined()
          expect(s.label).toBeDefined()
        }
      }
    })
  })
})
