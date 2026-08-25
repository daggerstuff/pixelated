/**
 * Portal — Messaging Thread Item API (F1.11)
 *
 * GET    /api/portal/v1/messaging/[threadId]  — get thread detail with messages
 * DELETE /api/portal/v1/messaging/[threadId]  — delete thread
 * POST   /api/portal/v1/messaging/[threadId]  — add message to thread
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
  PortalMessagingService,
  type CreateMessageInput,
} from '@/lib/ehr-native/services'
import { withV1Contract } from '@/lib/middleware/with-v1-contract'

/**
 * GET /api/portal/v1/messaging/[threadId]
 * Get a specific thread with all messages.
 * @returns 200 with thread, or 403/404
 */
export const GET = withV1Contract('portalGetThread', async (ctx, caller) => {
  const threadId = ctx.params?.['threadId']
  if (!threadId) return ehrValidationError('Thread ID is required.')

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
  const service = new PortalMessagingService(guard.rlsContext)
  const thread = await service.getThread(threadId, patientId)
  if (!thread) return ehrNotFound('Thread', threadId)

  return ehrSuccess(thread)
})

/**
 * DELETE /api/portal/v1/messaging/[threadId]
 * Delete a message thread.
 * @returns 200 with confirmation, or 403/404
 */
export const DELETE = withV1Contract(
  'portalDeleteThread',
  async (ctx, caller) => {
    const threadId = ctx.params?.['threadId']
    if (!threadId) return ehrValidationError('Thread ID is required.')

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

    const patientId = resolvePortalPatientId(caller.user.id)
    const service = new PortalMessagingService(guard.rlsContext)
    const deleted = await service.deleteThread(threadId, patientId)
    if (!deleted) return ehrNotFound('Thread', threadId)

    return ehrSuccess({ deleted: true, id: threadId })
  },
)

/**
 * POST /api/portal/v1/messaging/[threadId]
 * Add a message to an existing thread.
 * @returns 201 with updated thread, or 403/404/400
 */
export const POST = withV1Contract('portalAddMessage', async (ctx, caller) => {
  const threadId = ctx.params?.['threadId']
  if (!threadId) return ehrValidationError('Thread ID is required.')

  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId)
    return ehrValidationError('Tenant association required for portal access.')

  const guard = requirePortalClient(
    caller.user.role as UserRole,
    caller.user.id,
    tenantId,
  )
  if (!guard.allowed) return guard.response

  const raw = await ctx.request.json().catch(() => null)
  if (!raw || typeof raw !== 'object')
    return ehrValidationError('Request body must be a JSON object.')

  const body = raw as Record<string, unknown>
  const messageBody = body['body'] as string | undefined
  if (!messageBody) return ehrValidationError('body is required for message.')

  const patientId = resolvePortalPatientId(caller.user.id)
  const input: CreateMessageInput = {
    threadId,
    senderReference: `Patient/${patientId}`,
    recipientReference:
      (body['recipientReference'] as string | undefined) ?? '',
    body: messageBody,
  }

  const service = new PortalMessagingService(guard.rlsContext)

  try {
    const thread = await service.addMessage(input)
    if (!thread) return ehrNotFound('Thread', threadId)
    return ehrSuccess(thread)
  } catch (err) {
    return ehrValidationError(
      err instanceof Error ? err.message : 'Failed to add message.',
    )
  }
})
