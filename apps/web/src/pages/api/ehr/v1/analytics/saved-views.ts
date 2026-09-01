import {
  getOrCreateUserSettings,
  updateUserSettings,
} from '@/lib/db/user-settings'
import {
  resolveTenantId,
  requireEHRPermission,
  ehrValidationError,
  ehrSuccess,
  ehrCreated,
} from '@/lib/ehr-native/api'
import { withV1Contract } from '@/lib/middleware/with-v1-contract'

/**
 * Saved views API for EHR customizable dashboards.
 * Views are stored in user_settings.preferences.dashboardViews as DashboardLayout[].
 *
 * GET    /api/ehr/v1/analytics/saved-views?dashboard=<type>  — list views for a dashboard
 * POST   /api/ehr/v1/analytics/saved-views                    — create or update a view
 * DELETE /api/ehr/v1/analytics/saved-views?id=<viewId>        — delete a view
 * PUT    /api/ehr/v1/analytics/saved-views?id=<viewId>        — set default view
 */

const VIEWS_KEY = 'dashboardViews'

interface SavedView {
  id: string
  name: string
  dashboard: string
  isDefault: boolean
  isShared: boolean
  ownerId: string
  widgets: Array<{
    widgetId: string
    colSpan: number
    rowSpan: number
    order: number
  }>
  timeRange?: { start: string; end: string }
  createdAt: string
  updatedAt: string
}

/**
 * GET /api/ehr/v1/analytics/saved-views
 * Lists saved views for the caller, optionally filtered by dashboard type.
 * @returns 200 with views array, or 403
 */
export const GET = withV1Contract('listSavedViews', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId)
    return ehrValidationError('Tenant association required for EHR access.')

  const perm = await requireEHRPermission(
    caller.user.role,
    'read_patient',
    caller.user.id,
    tenantId,
  )
  if (!perm.allowed) return perm.response

  const url = new URL(ctx.request.url)
  const dashboard = url.searchParams.get('dashboard') ?? undefined

  const settings = await getOrCreateUserSettings(caller.user.id)
  const allViews = (settings.preferences?.[VIEWS_KEY] as SavedView[]) ?? []
  const views = dashboard
    ? allViews.filter((v) => v.dashboard === dashboard)
    : allViews

  return ehrSuccess({ views })
})

/**
 * POST /api/ehr/v1/analytics/saved-views
 * Creates or updates a saved view. If body.id matches an existing view, updates it.
 * @returns 201 with the saved view, or 403/400
 */
export const POST = withV1Contract('saveView', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId)
    return ehrValidationError('Tenant association required for EHR access.')

  const perm = await requireEHRPermission(
    caller.user.role,
    'read_patient',
    caller.user.id,
    tenantId,
  )
  if (!perm.allowed) return perm.response

  const raw = await ctx.request.json().catch(() => null)
  if (!raw) return ehrValidationError('Request body must be valid JSON.')

  const view = raw as Partial<SavedView>
  if (!view.name || typeof view.name !== 'string')
    return ehrValidationError('View name is required.')
  if (!view.dashboard || typeof view.dashboard !== 'string')
    return ehrValidationError('View dashboard type is required.')

  const settings = await getOrCreateUserSettings(caller.user.id)
  const existing = (settings.preferences?.[VIEWS_KEY] as SavedView[]) ?? []

  const now = new Date().toISOString()
  let saved: SavedView

  if (view.id && existing.some((v) => v.id === view.id)) {
    // Update existing
    saved = {
      ...existing.find((v) => v.id === view.id)!,
      ...view,
      ownerId: caller.user.id,
      updatedAt: now,
    } as SavedView

    const updated = existing.map((v) => (v.id === saved.id ? saved : v))
    await updateUserSettings(caller.user.id, {
      [`preferences.${VIEWS_KEY}`]: updated,
    })
  } else {
    // Create new
    saved = {
      id: crypto.randomUUID(),
      name: view.name,
      dashboard: view.dashboard,
      isDefault: view.isDefault ?? false,
      isShared: view.isShared ?? false,
      ownerId: caller.user.id,
      widgets: view.widgets ?? [],
      timeRange: view.timeRange,
      createdAt: now,
      updatedAt: now,
    } as SavedView

    // If setting as default, clear other defaults for this dashboard
    let updated = [...existing, saved]
    if (saved.isDefault) {
      updated = updated.map((v) =>
        v.id === saved.id || v.dashboard !== saved.dashboard
          ? v
          : { ...v, isDefault: false },
      )
    }
    await updateUserSettings(caller.user.id, {
      [`preferences.${VIEWS_KEY}`]: updated,
    })
  }

  return ehrCreated(saved)
})

/**
 * DELETE /api/ehr/v1/analytics/saved-views?id=<viewId>
 * Deletes a saved view by ID.
 * @returns 200 with success, or 403/400/404
 */
export const DELETE = withV1Contract('deleteView', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId)
    return ehrValidationError('Tenant association required for EHR access.')

  const perm = await requireEHRPermission(
    caller.user.role,
    'read_patient',
    caller.user.id,
    tenantId,
  )
  if (!perm.allowed) return perm.response

  const url = new URL(ctx.request.url)
  const viewId = url.searchParams.get('id')
  if (!viewId) return ehrValidationError('id query parameter is required.')

  const settings = await getOrCreateUserSettings(caller.user.id)
  const existing = (settings.preferences?.[VIEWS_KEY] as SavedView[]) ?? []
  const filtered = existing.filter((v) => v.id !== viewId)

  if (filtered.length === existing.length)
    return ehrValidationError('Saved view not found.')

  await updateUserSettings(caller.user.id, {
    [`preferences.${VIEWS_KEY}`]: filtered,
  })

  return ehrSuccess({ deleted: viewId })
})

/**
 * PUT /api/ehr/v1/analytics/saved-views?id=<viewId>
 * Sets a saved view as the default for its dashboard type.
 * @returns 200 with updated views, or 403/400/404
 */
export const PUT = withV1Contract('setDefaultView', async (ctx, caller) => {
  const tenantId = resolveTenantId(caller.user.accountId)
  if (!tenantId)
    return ehrValidationError('Tenant association required for EHR access.')

  const perm = await requireEHRPermission(
    caller.user.role,
    'read_patient',
    caller.user.id,
    tenantId,
  )
  if (!perm.allowed) return perm.response

  const url = new URL(ctx.request.url)
  const viewId = url.searchParams.get('id')
  if (!viewId) return ehrValidationError('id query parameter is required.')

  const settings = await getOrCreateUserSettings(caller.user.id)
  const existing = (settings.preferences?.[VIEWS_KEY] as SavedView[]) ?? []
  const target = existing.find((v) => v.id === viewId)
  if (!target) return ehrValidationError('Saved view not found.')

  const updated = existing.map((v) => {
    if (v.dashboard !== target.dashboard) return v
    return {
      ...v,
      isDefault: v.id === viewId,
    }
  })

  await updateUserSettings(caller.user.id, {
    [`preferences.${VIEWS_KEY}`]: updated,
  })

  return ehrSuccess({ views: updated })
})
