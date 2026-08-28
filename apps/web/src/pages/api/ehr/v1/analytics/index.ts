import {
  resolveTenantId,
  requireEHRPermission,
  ehrValidationError,
  ehrSuccess,
  sanitizeSearchParam,
} from '@/lib/ehr-native/api'
import {
  AnalyticsService,
  DASHBOARD_TYPES,
  canAccessDashboard,
  type DashboardType,
  type DashboardFilter,
} from '@/lib/ehr-native/services'
import { withV1Contract } from '@/lib/middleware/with-v1-contract'

/**
 * GET /api/ehr/v1/analytics
 * Retrieves dashboard metrics for the specified dashboard type.
 *
 * Query params:
 *   type (required) — 'practice' | 'outcomes' | 'utilization' | 'billing' | 'compliance'
 *   startDate (optional) — ISO date string for time range start
 *   endDate (optional) — ISO date string for time range end
 *   provider (optional) — filter by provider ID
 *   location (optional) — filter by location ID
 *   payer (optional) — filter by payer ID
 * @returns 200 with dashboard metrics, or 403/400
 */
export const GET = withV1Contract('getDashboard', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId)
    return ehrValidationError('Tenant association required for EHR access.')

  const url = new URL(ctx.request.url)
  const rawType = url.searchParams.get('type') ?? undefined
  if (!rawType) return ehrValidationError('type query parameter is required.')

  const type = sanitizeSearchParam(rawType, 20) as DashboardType
  if (!DASHBOARD_TYPES.includes(type))
    return ehrValidationError(
      `type must be one of: ${DASHBOARD_TYPES.join(', ')}`,
    )

  // RBAC: verify the user's role can access this dashboard type
  if (!canAccessDashboard(caller.user.role as any, type))
    return ehrValidationError(
      `Your role does not have permission to access the ${type} dashboard.`,
    )

  // Require a read permission appropriate to the dashboard
  const dashboardPerms: Record<DashboardType, string> = {
    practice: 'read_patient',
    outcomes: 'read_observation',
    utilization: 'read_encounter',
    billing: 'read_claim',
    compliance: 'audit_access',
  }
  const perm = await requireEHRPermission(
    caller.user.role,
    dashboardPerms[type] as any,
    caller.user.id,
    tenantId,
  )
  if (!perm.allowed) return perm.response

  // Parse optional filter params
  const startDate = url.searchParams.get('startDate') ?? undefined
  const endDate = url.searchParams.get('endDate') ?? undefined
  const provider = url.searchParams.get('provider') ?? undefined
  const location = url.searchParams.get('location') ?? undefined
  const payer = url.searchParams.get('payer') ?? undefined

  const filter: DashboardFilter = {}
  if (startDate && endDate) {
    filter.timeRange = { start: startDate, end: endDate }
  }
  if (provider) filter.providerId = sanitizeSearchParam(provider, 64)
  if (location) filter.siteId = sanitizeSearchParam(location, 64)
  if (payer) filter.payerId = sanitizeSearchParam(payer, 64)

  const service = new AnalyticsService(perm.rlsContext)

  try {
    const metrics = await service.getDashboard(
      type,
      caller.user.role as any,
      filter,
    )
    return ehrSuccess(metrics)
  } catch (err) {
    return ehrValidationError(
      err instanceof Error ? err.message : 'Failed to retrieve dashboard data.',
    )
  }
})
