import {
  resolveTenantId,
  requireEHRPermission,
  ehrSuccess,
  ehrValidationError,
  ehrNotFound,
} from '@/lib/ehr-native/api'
import { noteSigningService } from '@/lib/ehr-native/services'
import { withV1Contract } from '@/lib/middleware/with-v1-contract'
import { z } from 'zod'

/**
 * POST /api/ehr/ai/note-drafting
 *
 * Gateway proxy to the AI Note Drafting FastAPI microservice.
 * Accepts a telehealth transcript and returns a SOAP/DAP clinical note draft.
 *
 * Auth: requires `write_clinical_note` EHR permission.
 * BAA gate: enforced by the downstream FastAPI service.
 */

const NOTE_DRAFTING_SERVICE_URL =
  (import.meta.env['NOTE_DRAFTING_SERVICE_URL'] as string | undefined) ??
  (process.env['NOTE_DRAFTING_SERVICE_URL'] as string | undefined) ??
  ''

const NOTE_DRAFTING_SERVICE_TIMEOUT_MS = 60_000

const draftRequestSchema = z.object({
  transcript: z.string().min(10).max(50_000),
  patient_id: z.string().min(1).max(128),
  session_id: z.string().min(1).max(128),
  note_format: z.enum(['SOAP', 'DAP']).default('SOAP'),
})

export const POST = withV1Contract('draftClinicalNote', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId) {
    return ehrValidationError('Tenant association required for EHR access.')
  }

  const perm = await requireEHRPermission(
    caller.user.role,
    'write_clinical_note',
    caller.user.id,
    tenantId,
  )
  if (!perm.allowed) return perm.response

  const raw = await ctx.request.json().catch(() => null)
  if (!raw || typeof raw !== 'object') {
    return ehrValidationError('Request body must be a JSON object.')
  }

  const parsed = draftRequestSchema.safeParse(raw)
  if (!parsed.success) {
    return ehrValidationError(
      `Invalid request body: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
    )
  }

  if (!NOTE_DRAFTING_SERVICE_URL) {
    return ehrNotFound('note-drafting-service', 'NOTE_DRAFTING_SERVICE_URL')
  }

  try {
    const upstream = await fetch(NOTE_DRAFTING_SERVICE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(parsed.data),
      signal: AbortSignal.timeout(NOTE_DRAFTING_SERVICE_TIMEOUT_MS),
    })

    if (upstream.status === 403) {
      return ehrValidationError(
        'Note drafting service BAA not confirmed. Contact your administrator.',
      )
    }

    if (upstream.status === 422) {
      const errorBody = await upstream.json().catch(() => null)
      return ehrValidationError(
        errorBody?.detail ?? 'Transcript validation failed.',
      )
    }

    if (!upstream.ok) {
      const errorBody = await upstream.json().catch(() => null)
      return ehrValidationError(
        errorBody?.detail ?? `Note drafting service error (HTTP ${upstream.status}).`,
      )
    }

    const data = await upstream.json()

    // Tag AI-drafted note with draft status and register for sign-off tracking
    // PIX-4426 G2.1: AI notes must be 'preliminary' and cannot be auto-signed
    const noteId =
      (data as Record<string, unknown>)['id'] as string | undefined ??
      crypto.randomUUID()
    const taggedData = {
      ...data,
      id: noteId,
      docStatus: 'preliminary',
      aiOrigin: {
        drafter: 'note-drafting-service',
        draftedAt: new Date().toISOString(),
      },
    }

    noteSigningService.registerAIDraft({
      noteId,
      drafter: 'note-drafting-service',
      patientId: parsed.data.patient_id,
      encounterId: parsed.data.session_id,
      draftedAt: taggedData.aiOrigin.draftedAt,
      tenantId,
    })

    return ehrSuccess(taggedData)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown error calling note drafting service.'
    return ehrValidationError(`Note drafting request failed: ${message}`)
  }
})
