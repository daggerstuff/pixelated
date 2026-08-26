import {
  resolveTenantId,
  requireEHRPermission,
  ehrSuccess,
  ehrCreated,
  ehrValidationError,
} from '@/lib/ehr-native/api'
import { noteTemplateService } from '@/lib/ehr-native/services'
import type { NoteModality } from '@/lib/ehr-native/services'
/** EHR Native — Notes Collection API (F1.6) */
import { withV1Contract } from '@/lib/middleware/with-v1-contract'

/**
 * GET /api/ehr/v1/notes
 * List note templates, optionally filtered by modality.
 * @returns 200 with template list, or 403/400
 */
export const GET = withV1Contract('listNoteTemplates', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId)
    return ehrValidationError('Tenant association required for EHR access.')
  const perm = await requireEHRPermission(
    caller.user.role,
    'read_clinical_note',
    caller.user.id,
    tenantId,
  )
  if (!perm.allowed) return perm.response

  const url = new URL(ctx.request.url)
  const modality = url.searchParams.get('modality') ?? undefined

  if (modality) {
    const templates = noteTemplateService.listTemplates(
      modality as NoteModality,
    )
    return ehrSuccess(templates)
  }
  const templates = noteTemplateService.listTemplates()
  return ehrSuccess(templates)
})

/**
 * POST /api/ehr/v1/notes
 * Create a note (DocumentReference) from a template.
 * Body: { templateId, patientId, encounterId?, values }
 * @returns 201 with created DocumentReference, or 403/400
 */
export const POST = withV1Contract('createNote', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId)
    return ehrValidationError('Tenant association required for EHR access.')
  const perm = await requireEHRPermission(
    caller.user.role,
    'write_clinical_note',
    caller.user.id,
    tenantId,
  )
  if (!perm.allowed) return perm.response

  const raw = await ctx.request.json().catch(() => null)
  if (!raw || typeof raw !== 'object')
    return ehrValidationError('Request body must be a JSON object.')

  const body = raw as Record<string, unknown>
  const templateId = body['templateId'] as string | undefined
  const patientId = body['patientId'] as string | undefined
  const encounterId = body['encounterId'] as string | undefined
  const values = body['values'] as Record<string, unknown> | undefined

  if (!templateId) return ehrValidationError('templateId is required.')
  if (!patientId) return ehrValidationError('patientId is required.')

  try {
    const note = noteTemplateService.createNoteFromTemplate({
      templateId,
      patientId,
      encounterId,
      values,
    } as never)
    return ehrCreated(note)
  } catch (err) {
    return ehrValidationError(
      err instanceof Error
        ? err.message
        : 'Failed to create note from template.',
    )
  }
})
