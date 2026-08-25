/**
 * Portal — Homework Assignment Item API (F1.11)
 *
 * GET   /api/portal/v1/homework/[assignmentId]  — get assignment detail
 * PATCH /api/portal/v1/homework/[assignmentId]  — update assignment (add notes, change status)
 * POST  /api/portal/v1/homework/[assignmentId]  — mark assignment complete
 */

import type { UserRole } from '@/lib/auth/roles'
import {
  resolveTenantId,
  ehrSuccess,
  ehrValidationError,
  ehrNotFound,
} from '@/lib/ehr-native/api'
import {
  requirePortalClient,
  resolvePortalPatientId,
} from '@/lib/ehr-native/auth/portal-guard'
import {
  PortalHomeworkService,
  type UpdateHomeworkInput,
} from '@/lib/ehr-native/services'
import { withV1Contract } from '@/lib/middleware/with-v1-contract'

/**
 * GET /api/portal/v1/homework/[assignmentId]
 * Get a specific homework assignment.
 * @returns 200 with assignment, or 403/404
 */
export const GET = withV1Contract('portalGetHomework', async (ctx, caller) => {
  const assignmentId = ctx.params?.['assignmentId']
  if (!assignmentId) return ehrValidationError('Assignment ID is required.')

  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId)
    return ehrValidationError('Tenant association required for portal access.')

  const guard = requirePortalClient(
    caller.user.role as UserRole,
    caller.user.id,
    tenantId,
  )
  if (!guard.allowed) return guard.response

  const patientId = resolvePortalPatientId(caller.user.id)
  const service = new PortalHomeworkService(guard.rlsContext)
  const assignment = await service.getAssignment(assignmentId, patientId)
  if (!assignment) return ehrNotFound('Homework', assignmentId)

  return ehrSuccess(assignment)
})

/**
 * PATCH /api/portal/v1/homework/[assignmentId]
 * Update a homework assignment (e.g., add patient notes, change status).
 * @returns 200 with updated assignment, or 403/404/400
 */
export const PATCH = withV1Contract(
  'portalUpdateHomework',
  async (ctx, caller) => {
    const assignmentId = ctx.params?.['assignmentId']
    if (!assignmentId) return ehrValidationError('Assignment ID is required.')

    const tenantId = resolveTenantId(caller.user.accountId)
    if (!tenantId)
      return ehrValidationError(
        'Tenant association required for portal access.',
      )

    const guard = requirePortalClient(
      caller.user.role as UserRole,
      caller.user.id,
      tenantId,
    )
    if (!guard.allowed) return guard.response

    const raw = await ctx.request.json().catch(() => null)
    if (!raw || typeof raw !== 'object')
      return ehrValidationError('Request body must be a JSON object.')

    const patientId = resolvePortalPatientId(caller.user.id)
    const updates: UpdateHomeworkInput = {}

    const status = (raw as Record<string, unknown>)['status']
    if (typeof status === 'string')
      updates.status = status as 'assigned' | 'in-progress' | 'completed'

    const patientNotes = (raw as Record<string, unknown>)['patientNotes']
    if (typeof patientNotes === 'string') updates.patientNotes = patientNotes

    const service = new PortalHomeworkService(guard.rlsContext)

    try {
      const assignment = await service.updateAssignment(
        assignmentId,
        patientId,
        updates,
      )
      if (!assignment) return ehrNotFound('Homework', assignmentId)
      return ehrSuccess(assignment)
    } catch (err) {
      return ehrValidationError(
        err instanceof Error ? err.message : 'Failed to update homework.',
      )
    }
  },
)

/**
 * POST /api/portal/v1/homework/[assignmentId]
 * Mark a homework assignment as complete.
 * @returns 200 with completed assignment, or 403/404/400
 */
export const POST = withV1Contract(
  'portalCompleteHomework',
  async (ctx, caller) => {
    const assignmentId = ctx.params?.['assignmentId']
    if (!assignmentId) return ehrValidationError('Assignment ID is required.')

    const tenantId = resolveTenantId(caller.user.accountId)
    if (!tenantId)
      return ehrValidationError(
        'Tenant association required for portal access.',
      )

    const guard = requirePortalClient(
      caller.user.role as UserRole,
      caller.user.id,
      tenantId,
    )
    if (!guard.allowed) return guard.response

    const raw = await ctx.request.json().catch(() => null)
    const patientNotes =
      raw && typeof raw === 'object'
        ? ((raw as Record<string, unknown>)['patientNotes'] as
            | string
            | undefined)
        : undefined

    const patientId = resolvePortalPatientId(caller.user.id)
    const service = new PortalHomeworkService(guard.rlsContext)

    try {
      const assignment = await service.completeAssignment(
        assignmentId,
        patientId,
        patientNotes,
      )
      if (!assignment) return ehrNotFound('Homework', assignmentId)
      return ehrSuccess(assignment)
    } catch (err) {
      return ehrValidationError(
        err instanceof Error ? err.message : 'Failed to complete homework.',
      )
    }
  },
)
