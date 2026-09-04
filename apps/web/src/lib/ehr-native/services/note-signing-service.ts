/**
 * @vitest-environment node
 *
 * NoteSigningService — Compliance guard rail preventing AI-generated clinical
 * notes from being auto-signed. A licensed clinician must explicitly review and
 * sign AI-drafted notes before they enter the patient chart.
 *
 * PIX-4426 G2.1 — AI No Auto-Sign Gate
 */

import {
  EHRAuditService,
  EHRAuditAction,
  EHRResourceType,
  type EHRAuditMetadata,
} from '../audit'
import type { RLSContext } from '../repositories'
import type { DocumentReference } from '../types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Metadata tracking an AI-drafted note awaiting clinician sign-off. */
export interface AIDraftMetadata {
  /** Unique note identifier */
  noteId: string
  /** AI system that drafted the note (e.g., 'note-drafting-service') */
  drafter: string
  /** Patient ID the note belongs to, if known */
  patientId?: string
  /** Encounter ID the note belongs to, if known */
  encounterId?: string
  /** Timestamp the draft was created (ISO 8601) */
  draftedAt: string
  /** Tenant ID for multi-tenant isolation */
  tenantId: string
}

/** Input for signing a note. */
export interface SignNoteInput {
  /** Unique note identifier (from URL param or draft registry) */
  noteId: string
  /** The note to sign (DocumentReference) */
  note: DocumentReference
  /** Patient ID for audit and permission scoping */
  patientId?: string
  /** Encounter ID for audit context */
  encounterId?: string
  /** Clinician's user ID (the signer) */
  signerUserId: string
  /** FHIR reference for the signer (e.g., 'Practitioner/{uuid}') */
  signerRef: string
  /** RLS context for the signing operation */
  rlsContext: RLSContext
  /** Whether break-glass was activated */
  breakGlassActivated?: boolean
}

/** Result of a sign operation. */
export type SignNoteResult =
  | { success: true; signedNote: DocumentReference }
  | { success: false; error: string }

/** Result of validating a manual sign request. */
export interface ManualSignValidation {
  /** Whether the request appears to be an automated/batch sign attempt */
  isAutomated: boolean
  /** Reason for rejection if automated */
  reason?: string
}

// ---------------------------------------------------------------------------
// AI Draft Registry (in-memory)
// ---------------------------------------------------------------------------

/**
 * In-memory registry of AI-drafted notes awaiting clinician sign-off.
 * In production, this would be backed by a database table tracking draft
 * status, drafter identity, and sign-off state.
 */
class AIDraftRegistry {
  // Durable registry: in production backed by FHIR DocumentReference persistence.
  // For serverless, use globalThis to share across hot reloads; cross-instance
  // DB persistence deferred until the FHIR DocumentReference table is available.
  private get drafts(): Map<string, AIDraftMetadata> {
    const g = globalThis as unknown as Record<string, unknown>
    if (!g['aidDraftRegistry']) {
      g['aidDraftRegistry'] = new Map<string, AIDraftMetadata>()
    }
    return g['aidDraftRegistry'] as Map<string, AIDraftMetadata>
  }

  /** Register a new AI-drafted note. */
  register(meta: AIDraftMetadata): void {
    this.drafts.set(meta.noteId, meta)
  }

  /** Check if a note ID is a registered AI draft. */
  isRegistered(noteId: string): boolean {
    return this.drafts.has(noteId)
  }

  /** Get draft metadata for a note. */
  get(noteId: string): AIDraftMetadata | undefined {
    return this.drafts.get(noteId)
  }

  /** Remove a draft from the registry (after signing). */
  remove(noteId: string): boolean {
    return this.drafts.delete(noteId)
  }

  /** Clear all drafts (for testing). */
  clear(): void {
    this.drafts.clear()
  }
}

// ---------------------------------------------------------------------------
// NoteSigningService
// ---------------------------------------------------------------------------

/**
 * Service enforcing the AI No Auto-Sign compliance gate.
 *
 * Ensures AI-generated clinical notes:
 * 1. Are created with 'preliminary' (draft) status
 * 2. Cannot be auto-signed — only explicit manual clinician sign-off
 * 3. Have a complete audit trail recording drafter, signer, and timestamp
 *
 * Design: The service maintains an in-memory registry of AI-drafted notes.
 * The note-drafting endpoint registers each draft; the sign endpoint
 * validates the note is a registered draft before allowing sign-off.
 */
export class NoteSigningService {
  private readonly registry = new AIDraftRegistry()

  /**
   * Register an AI-drafted note in the registry.
   * Called by the note-drafting endpoint after creating a draft.
   */
  registerAIDraft(meta: AIDraftMetadata): void {
    this.registry.register(meta)
  }

  /**
   * Check if a note is a registered AI draft.
   */
  isAIDraft(noteId: string): boolean {
    return this.registry.isRegistered(noteId)
  }

  /**
   * Get draft metadata for a note.
   */
  getDraftMetadata(noteId: string): AIDraftMetadata | undefined {
    return this.registry.get(noteId)
  }

  /**
   * Validate that a sign request is manual (not automated/batch).
   *
   * Checks for indicators of automated or batch signing:
   * - Array of notes (batch request)
   * - `automated` or `autoSign` flags in the request body
   * - `batch` flag or `noteIds`/`notes` array in the request body
   *
   * This is the service-level guard complementing the API endpoint's
   * single-note-only design.
   */
  validateManualSign(body: unknown): ManualSignValidation {
    // Reject arrays — only single-note signing is allowed
    if (Array.isArray(body)) {
      return {
        isAutomated: true,
        reason:
          'Batch signing of AI-drafted notes is prohibited. Only individual manual sign-off is allowed.',
      }
    }

    if (body && typeof body === 'object') {
      const obj = body as Record<string, unknown>

      // Reject explicit automation flags
      if (obj['automated'] === true || obj['autoSign'] === true) {
        return {
          isAutomated: true,
          reason:
            'Automated signing of AI-drafted notes is prohibited. Explicit clinician sign-off is required.',
        }
      }

      // Reject batch indicators
      if (
        obj['batch'] === true ||
        obj['noteIds'] !== undefined ||
        obj['notes'] !== undefined
      ) {
        return {
          isAutomated: true,
          reason:
            'Batch signing of AI-drafted notes is prohibited. Only individual manual sign-off is allowed.',
        }
      }
    }

    return { isAutomated: false }
  }

  /**
   * Sign an AI-drafted note with clinician verification.
   *
   * Enforces:
   * - Note must be a registered AI draft
   * - Note must have 'preliminary' docStatus (not already signed)
   * - Note's status must be 'current' (not superseded or entered-in-error)
   * - Audit trail is logged with drafter, signer, and timestamp
   *
   * @returns Signed DocumentReference on success, error message on failure
   */
  async signNote(input: SignNoteInput): Promise<SignNoteResult> {
    const { noteId, note, signerUserId, signerRef, rlsContext } = input

    // Check the note is a registered AI draft
    const draftMeta = this.registry.get(noteId)
    if (!draftMeta) {
      return {
        success: false,
        error:
          'Note is not a registered AI draft. Only AI-drafted notes can be signed via this endpoint.',
      }
    }

    // Validate note is in draft (preliminary) status
    if (note.docStatus !== 'preliminary') {
      return {
        success: false,
        error: `Note is not in draft status (current: ${note.docStatus}). Only preliminary notes can be signed.`,
      }
    }

    // Validate note status is current (not superseded or entered-in-error)
    if (note.status !== 'current') {
      return {
        success: false,
        error: `Note status is '${note.status}'. Only 'current' notes can be signed.`,
      }
    }

    // Build the signed note
    const signedAt = new Date().toISOString()
    const signedNote: DocumentReference = {
      ...note,
      docStatus: 'final',
      authenticator: { reference: signerRef },
      date: signedAt,
    }

    // Log the audit trail with drafter, signer, and timestamp
    const auditMetadata: EHRAuditMetadata = {
      tenantId: rlsContext.tenantId,
      patientId: input.patientId,
      encounterId: input.encounterId,
      practitionerId: signerUserId,
      resourceType: EHRResourceType.DOCUMENT_REFERENCE,
      resourceId: noteId,
      permission: 'sign_clinical_note',
      breakGlass: input.breakGlassActivated ?? false,
      // AI origin metadata for compliance audit trail
      aiDrafter: draftMeta.drafter,
      aiDraftedAt: draftMeta.draftedAt,
      signedAt,
    }

    const auditService = EHRAuditService.getInstance()
    await auditService.logNoteAccess(EHRAuditAction.SIGN_NOTE, {
      noteId,
      patientId: input.patientId,
      encounterId: input.encounterId,
      userId: signerUserId,
      status: 'success',
      metadata: auditMetadata,
    })

    // Remove from draft registry — note is now signed
    this.registry.remove(noteId)

    return { success: true, signedNote }
  }

  /**
   * Clear the draft registry. For testing only.
   */
  clearRegistry(): void {
    this.registry.clear()
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const noteSigningService = new NoteSigningService()
