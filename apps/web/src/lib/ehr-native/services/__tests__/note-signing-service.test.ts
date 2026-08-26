/**
 * @vitest-environment node
 *
 * Unit tests for NoteSigningService — PIX-4426 G2.1 AI No Auto-Sign Gate.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

import { EHRAuditService, EHRAuditAction, EHRResourceType } from '../../audit'
import type { RLSContext } from '../../repositories'
import type { DocumentReference } from '../../types'
import { NoteSigningService } from '../note-signing-service'

function makeDraftNote(): DocumentReference {
  return {
    resourceType: 'DocumentReference',
    status: 'current',
    docStatus: 'preliminary',
    type: {
      coding: [{ system: 'http://loinc.org', code: '11506-3' }],
      text: 'Progress note',
    },
    subject: { reference: 'Patient/patient-001' },
    author: [{ reference: 'Practitioner/ai-system' }],
    content: [
      {
        attachment: {
          contentType: 'application/json',
          data: btoa(JSON.stringify({ soap: { subjective: 'Test' } })),
          title: 'AI-drafted clinical note',
        },
      },
    ],
  }
}

function makeRLSContext(): RLSContext {
  return {
    tenantId: 'tenant-001',
    userId: 'clinician-001',
    role: 'physician',
  }
}

describe('NoteSigningService', () => {
  let service: NoteSigningService

  beforeEach(() => {
    service = new NoteSigningService()
  })

  describe('registerAIDraft', () => {
    it('registers an AI-drafted note for tracking', () => {
      service.registerAIDraft({
        noteId: 'note-001',
        drafter: 'note-drafting-service',
        patientId: 'patient-001',
        draftedAt: '2025-01-01T00:00:00.000Z',
        tenantId: 'tenant-001',
      })

      expect(service.isAIDraft('note-001')).toBe(true)
    })

    it('retrieves draft metadata after registration', () => {
      const meta = {
        noteId: 'note-002',
        drafter: 'note-drafting-service',
        patientId: 'patient-002',
        encounterId: 'encounter-001',
        draftedAt: '2025-01-01T00:00:00.000Z',
        tenantId: 'tenant-001',
      }
      service.registerAIDraft(meta)

      const retrieved = service.getDraftMetadata('note-002')
      expect(retrieved).toBeDefined()
      expect(retrieved?.drafter).toBe('note-drafting-service')
      expect(retrieved?.patientId).toBe('patient-002')
    })

    it('returns false for unregistered note IDs', () => {
      expect(service.isAIDraft('nonexistent')).toBe(false)
    })
  })

  describe('validateManualSign', () => {
    it('allows single-note manual sign requests', () => {
      const result = service.validateManualSign({
        note: { resourceType: 'DocumentReference' },
        signer_ref: 'Practitioner/clinician-001',
      })

      expect(result.isAutomated).toBe(false)
    })

    it('rejects array (batch) requests', () => {
      const result = service.validateManualSign([{ note: {} }, { note: {} }])

      expect(result.isAutomated).toBe(true)
      expect(result.reason).toContain('Batch signing')
    })

    it('rejects automated flag', () => {
      const result = service.validateManualSign({
        note: {},
        automated: true,
      })

      expect(result.isAutomated).toBe(true)
      expect(result.reason).toContain('Automated signing')
    })

    it('rejects autoSign flag', () => {
      const result = service.validateManualSign({
        note: {},
        autoSign: true,
      })

      expect(result.isAutomated).toBe(true)
      expect(result.reason).toContain('Automated signing')
    })

    it('rejects batch flag', () => {
      const result = service.validateManualSign({
        note: {},
        batch: true,
      })

      expect(result.isAutomated).toBe(true)
      expect(result.reason).toContain('Batch signing')
    })

    it('rejects noteIds array (batch indicator)', () => {
      const result = service.validateManualSign({
        noteIds: ['note-001', 'note-002'],
      })

      expect(result.isAutomated).toBe(true)
      expect(result.reason).toContain('Batch signing')
    })

    it('rejects notes array (batch indicator)', () => {
      const result = service.validateManualSign({
        notes: [{}, {}],
      })

      expect(result.isAutomated).toBe(true)
      expect(result.reason).toContain('Batch signing')
    })
  })

  describe('signNote — manual sign flow', () => {
    it('signs a registered AI draft note successfully', async () => {
      service.registerAIDraft({
        noteId: 'note-sign-001',
        drafter: 'note-drafting-service',
        patientId: 'patient-001',
        draftedAt: '2025-01-01T00:00:00.000Z',
        tenantId: 'tenant-001',
      })

      const note = makeDraftNote()
      const result = await service.signNote({
        noteId: 'note-sign-001',
        note,
        patientId: 'patient-001',
        signerUserId: 'clinician-001',
        signerRef: 'Practitioner/clinician-001',
        rlsContext: makeRLSContext(),
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.signedNote.docStatus).toBe('final')
        expect(result.signedNote.authenticator).toEqual({
          reference: 'Practitioner/clinician-001',
        })
        expect(result.signedNote.date).toBeDefined()
      }
    })

    it('removes the note from the draft registry after signing', async () => {
      service.registerAIDraft({
        noteId: 'note-sign-002',
        drafter: 'note-drafting-service',
        draftedAt: '2025-01-01T00:00:00.000Z',
        tenantId: 'tenant-001',
      })

      const note = makeDraftNote()
      await service.signNote({
        noteId: 'note-sign-002',
        note,
        signerUserId: 'clinician-001',
        signerRef: 'Practitioner/clinician-001',
        rlsContext: makeRLSContext(),
      })

      expect(service.isAIDraft('note-sign-002')).toBe(false)
    })
  })

  describe('signNote — validation failures', () => {
    it('fails when note is not a registered AI draft', async () => {
      const note = makeDraftNote()
      const result = await service.signNote({
        noteId: 'unregistered-note',
        note,
        signerUserId: 'clinician-001',
        signerRef: 'Practitioner/clinician-001',
        rlsContext: makeRLSContext(),
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('not a registered AI draft')
      }
    })

    it('fails when note is already signed (docStatus is final)', async () => {
      service.registerAIDraft({
        noteId: 'already-signed',
        drafter: 'note-drafting-service',
        draftedAt: '2025-01-01T00:00:00.000Z',
        tenantId: 'tenant-001',
      })

      const note = { ...makeDraftNote(), docStatus: 'final' as const }
      const result = await service.signNote({
        noteId: 'already-signed',
        note,
        signerUserId: 'clinician-001',
        signerRef: 'Practitioner/clinician-001',
        rlsContext: makeRLSContext(),
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('not in draft status')
      }
    })

    it('fails when note status is not current', async () => {
      service.registerAIDraft({
        noteId: 'superseded-note',
        drafter: 'note-drafting-service',
        draftedAt: '2025-01-01T00:00:00.000Z',
        tenantId: 'tenant-001',
      })

      const note = { ...makeDraftNote(), status: 'superseded' as const }
      const result = await service.signNote({
        noteId: 'superseded-note',
        note,
        signerUserId: 'clinician-001',
        signerRef: 'Practitioner/clinician-001',
        rlsContext: makeRLSContext(),
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain("'superseded'")
      }
    })
  })

  describe('signNote — audit trail', () => {
    it('logs SIGN_NOTE audit event with drafter, signer, and timestamp', async () => {
      const logSpy = vi
        .spyOn(EHRAuditService.prototype, 'logNoteAccess')
        .mockImplementation(() => undefined as never)

      service.registerAIDraft({
        noteId: 'audit-note',
        drafter: 'note-drafting-service',
        patientId: 'patient-audit',
        encounterId: 'encounter-audit',
        draftedAt: '2025-01-01T00:00:00.000Z',
        tenantId: 'tenant-001',
      })

      const note = makeDraftNote()
      await service.signNote({
        noteId: 'audit-note',
        note,
        patientId: 'patient-audit',
        encounterId: 'encounter-audit',
        signerUserId: 'clinician-audit',
        signerRef: 'Practitioner/clinician-audit',
        rlsContext: makeRLSContext(),
      })

      expect(logSpy).toHaveBeenCalledWith(
        EHRAuditAction.SIGN_NOTE,
        expect.objectContaining({
          noteId: 'audit-note',
          patientId: 'patient-audit',
          encounterId: 'encounter-audit',
          userId: 'clinician-audit',
          status: 'success',
          metadata: expect.objectContaining({
            aiDrafter: 'note-drafting-service',
            signedAt: expect.any(String),
            permission: 'sign_clinical_note',
            resourceType: EHRResourceType.DOCUMENT_REFERENCE,
          }),
        }),
      )

      logSpy.mockRestore()
    })
  })
})
