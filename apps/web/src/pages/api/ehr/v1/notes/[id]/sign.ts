/**
 * POST /api/ehr/v1/notes/:id/sign
 *
 * Manual clinician sign-off for an AI-drafted clinical note.
 *
 * Compliance gate (PIX-4426 G2.1):
 * - Verifies signer has `sign_clinical_note` permission via RBAC
 * - Blocks automated/batch signing — only individual manual sign-off
 * - Validates note is a registered AI draft in 'preliminary' status
 * - Logs full audit trail: note_id, drafter (AI), signer (clinician), signed_at
 */

import { z } from 'zod'

import {
  resolveTenantId,
  requireEHRPermission,
  requireEHRPermissionWithBreakGlass,
  sanitizeFhirId,
  ehrSuccess,
  ehrValidationError,
  ehrNotFound,
} from '@/lib/ehr-native/api'
import { noteSigningService } from '@/lib/ehr-native/services'
import { withV1Contract } from '@/lib/middleware/with-v1-contract'

const signRequestSchema = z.object({
  /** The AI-drafted note to sign (FHIR DocumentReference) */
  note: z.record(z.string(), z.unknown()),
  /** Patient ID for permission scoping and audit */
  patient_id: z.string().min(1).max(128).optional(),
  /** Encounter ID for audit context */
  encounter_id: z.string().min(1).max(128).optional(),
  /** FHIR reference for the signer (e.g., 'Practitioner/{uuid}') */
  signer_ref: z.string().min(1).max(256),
  breakGlassActivated: z.boolean().optional(),
  breakGlassReason: z.string().optional(),
})

export const POST = withV1Contract('signClinicalNote', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId)
    return ehrValidationError('Tenant association required for EHR access.')

  // Extract note ID from URL params
  const rawNoteId = ctx.params?.['id']
  if (!rawNoteId)
    return ehrValidationError('Note ID is required in the URL path.')

  let noteId: string
  try {
    noteId = sanitizeFhirId(rawNoteId, 'noteId')
  } catch (err) {
    return ehrValidationError(
      `Invalid note ID: ${err instanceof Error ? err.message : 'validation failed'}`,
    )
  }

  // Parse and validate request body
  const raw = await ctx.request.json().catch(() => null)
  if (!raw || typeof raw !== 'object')
    return ehrValidationError('Request body must be a JSON object.')

  // Auto-sign guard: reject batch/automated requests at service level
  const signValidation = noteSigningService.validateManualSign(raw)
  if (signValidation.isAutomated)
    return ehrValidationError(signValidation.reason!)

  const parsed = signRequestSchema.safeParse(raw)
  if (!parsed.success)
    return ehrValidationError(
      `Invalid request body: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
    )

  const {
    note,
    patient_id,
    encounter_id,
    signer_ref,
    breakGlassActivated,
    breakGlassReason,
  } = parsed.data as Record<string, unknown>

  // Verify the note ID in the URL matches the note in the body
  const bodyNoteId = (note as Record<string, unknown>)['id']
  if (bodyNoteId && bodyNoteId !== noteId)
    return ehrValidationError(
      'Note ID in URL does not match note ID in request body.',
    )

  // Verify the note is a registered AI draft
  if (!noteSigningService.isAIDraft(noteId))
    return ehrNotFound('ai-draft', noteId)

  // Check RBAC permission: signer must have sign_clinical_note
  const perm = await requireEHRPermissionWithBreakGlass(
    caller.user.role,
    'sign_clinical_note',
    caller.user.id,
    tenantId,
    patient_id,
    breakGlassActivated,
    breakGlassReason,
  )
  if (!perm.allowed) return perm.response

  // Sign the note via the service
  const result = await noteSigningService.signNote({
    noteId,
    note: note as never,
    patientId: patient_id,
    encounterId: encounter_id,
    signerUserId: caller.user.id,
    signerRef: signer_ref,
    rlsContext: perm.rlsContext,
    breakGlassActivated: breakGlassActivated ?? false,
  })

  if (!result.success) return ehrValidationError(result.error)

  return ehrSuccess(result.signedNote)
})
