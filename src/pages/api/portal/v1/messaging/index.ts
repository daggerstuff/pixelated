/**
 * Portal — Messaging API (F1.11)
 *
 * Secure messaging thread CRUD for client portal.
 *
 * GET  /api/portal/v1/messaging     — list patient message threads
 * POST /api/portal/v1/messaging     — create new thread
 */

import {
  resolveTenantId,
  sanitizeLimitParam,
  sanitizeOffsetParam,
  ehrValidationError,
  ehrPaginated,
  ehrCreated,
} from '@/lib/ehr-native/api'
import { withV1Contract } from '@/lib/middleware/with-v1-contract'
import {
  requirePortalClient,
  resolvePortalPatientId,
} from '@/lib/ehr-native/auth/portal-guard'
import {
  PortalMessagingService,
  type CreateThreadInput,
} from '@/lib/ehr-native/services'
import type { UserRole } from '@/lib/auth/roles'

/**
 * GET /api/portal/v1/messaging
 * List the authenticated patient's message threads.
 * @returns 200 with paginated threads, or 403/400
 */
export const GET = withV1Contract(
  'portalListThreads',
  async (ctx, caller) => {
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
    const url = new URL(ctx.request.url)
    const limit = sanitizeLimitParam(
      Number(url.searchParams.get('limit') ?? '50'),
      100,
    )
    const offset = sanitizeOffsetParam(
      Number(url.searchParams.get('offset') ?? '0'),
    )

    const service = new PortalMessagingService(guard.rlsContext)
    const result = await service.listThreads(patientId, { limit, offset })

    return ehrPaginated(result.threads, {
      limit,
      offset,
      total: result.total,
    })
  },
)

/**
 * POST /api/portal/v1/messaging
 * Create a new message thread.
 * @returns 201 with created thread, or 403/400
 */
export const POST = withV1Contract(
  'portalCreateThread',
  async (ctx, caller) => {
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
    const patientId = resolvePortalPatientId(caller.user.id)

    const subject = body['subject'] as string | undefined
    if (!subject)
      return ehrValidationError('subject is required.')

    const practitionerReference = body['practitionerReference'] as
      | string
      | undefined
    if (!practitionerReference)
      return ehrValidationError('practitionerReference is required.')

    const initialMessage = body['initialMessage'] as string | undefined
    if (!initialMessage)
      return ehrValidationError('initialMessage is required.')

    const input: CreateThreadInput = {
      patientId,
      subject,
      practitionerReference,
      initialMessage,
    }

    const service = new PortalMessagingService(guard.rlsContext)

    try {
      const thread = await service.createThread(input)
      return ehrCreated(thread)
    } catch (err) {
      return ehrValidationError(
        err instanceof Error ? err.message : 'Failed to create thread.',
      )
    }
  },
)
