/**
 * Portal — Homework API (F1.11)
 *
 * Homework assignment viewing and completion for client portal.
 *
 * GET /api/portal/v1/homework  — list patient homework assignments
 */

import {
  resolveTenantId,
  sanitizeLimitParam,
  sanitizeOffsetParam,
  sanitizeSearchParam,
  ehrValidationError,
  ehrPaginated,
} from '@/lib/ehr-native/api'
import { withV1Contract } from '@/lib/middleware/with-v1-contract'
import {
  requirePortalClient,
  resolvePortalPatientId,
} from '@/lib/ehr-native/auth/portal-guard'
import { PortalHomeworkService } from '@/lib/ehr-native/services'
import type { UserRole } from '@/lib/auth/roles'

/**
 * GET /api/portal/v1/homework
 * List the authenticated patient's homework assignments.
 * @returns 200 with paginated assignments, or 403/400
 */
export const GET = withV1Contract(
  'portalListHomework',
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
    const status = sanitizeSearchParam(
      url.searchParams.get('status') ?? '',
    )

    const service = new PortalHomeworkService(guard.rlsContext)
    const result = await service.listAssignments(patientId, {
      limit,
      offset,
      ...(status ? { status } : {}),
    })

    return ehrPaginated(result.assignments, {
      limit,
      offset,
      total: result.total,
    })
  },
)
