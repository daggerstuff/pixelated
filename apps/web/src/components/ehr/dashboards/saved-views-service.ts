/**
 * Saved views service for EHR customizable dashboards.
 *
 * Persists dashboard layouts (widget arrangements, time ranges) per user
 * via the server-side user-settings MongoDB collection (`preferences.dashboardViews`).
 * Falls back to localStorage when the API is unreachable or in restricted
 * environments so the dashboard remains usable offline.
 *
 * @module saved-views-service
 */

import type { DashboardLayout } from './types'
import type { DashboardType } from './types'

const STORAGE_PREFIX = 'ehr-dashboard-views'

/* ------------------------------------------------------------------ */
/* localStorage helpers (offline fallback)                            */
/* ------------------------------------------------------------------ */

function storageKey(userId: string, dashboard: DashboardType): string {
  return `${STORAGE_PREFIX}:${userId}:${dashboard}`
}

function readLocalViews(
  userId: string,
  dashboard: DashboardType,
): DashboardLayout[] {
  try {
    const raw = localStorage.getItem(storageKey(userId, dashboard))
    return raw ? (JSON.parse(raw) as DashboardLayout[]) : []
  } catch {
    return []
  }
}

function writeLocalViews(
  userId: string,
  dashboard: DashboardType,
  views: DashboardLayout[],
): void {
  try {
    localStorage.setItem(storageKey(userId, dashboard), JSON.stringify(views))
  } catch {
    /* quota exceeded — silently ignore */
  }
}

/* ------------------------------------------------------------------ */
/* API helpers (server-side MongoDB via user-settings)                */
/* ------------------------------------------------------------------ */

const API_BASE = '/api/ehr/v1/analytics/saved-views'

async function fetchViewsFromAPI(
  userId: string,
  dashboard: DashboardType,
): Promise<DashboardLayout[]> {
  const res = await fetch(
    `${API_BASE}?userId=${encodeURIComponent(userId)}&dashboard=${encodeURIComponent(dashboard)}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    },
  )
  if (!res.ok) throw new Error(`Failed to fetch saved views: ${res.status}`)
  const body = (await res.json()) as { data: { views: DashboardLayout[] } }
  return body.data?.views ?? []
}

async function saveViewToAPI(
  userId: string,
  view: DashboardLayout,
): Promise<DashboardLayout> {
  const res = await fetch(`${API_BASE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...view, ownerId: userId }),
  })
  if (!res.ok) throw new Error(`Failed to save view: ${res.status}`)
  const body = (await res.json()) as { data: DashboardLayout }
  return body.data
}

async function deleteViewFromAPI(
  userId: string,
  viewId: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}?id=${encodeURIComponent(viewId)}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error(`Failed to delete view: ${res.status}`)
}

async function setDefaultViewAPI(
  userId: string,
  dashboard: DashboardType,
  viewId: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}?id=${encodeURIComponent(viewId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, dashboard, viewId }),
  })
  if (!res.ok) throw new Error(`Failed to set default view: ${res.status}`)
}

/* ------------------------------------------------------------------ */
/* Public service                                                      */
/* ------------------------------------------------------------------ */

export const savedViewsService = {
  /**
   * Load all saved views for a given dashboard. Attempts the API first;
   * falls back to localStorage on network failure.
   */
  async loadViews(
    userId: string,
    dashboard: DashboardType,
  ): Promise<DashboardLayout[]> {
    try {
      return await fetchViewsFromAPI(userId, dashboard)
    } catch {
      return readLocalViews(userId, dashboard)
    }
  },

  /**
   * Persist (create or update) a saved view. Writes to API; mirrors to
   * localStorage as a cache so the dashboard works offline.
   */
  async saveView(
    userId: string,
    dashboard: DashboardType,
    view: DashboardLayout,
  ): Promise<DashboardLayout> {
    // Always update localStorage cache
    const local = readLocalViews(userId, dashboard)
    const idx = local.findIndex((v) => v.id === view.id)
    if (idx >= 0) local[idx] = view
    else local.push(view)
    writeLocalViews(userId, dashboard, local)

    try {
      return await saveViewToAPI(userId, view)
    } catch {
      // API failed — return the locally-cached copy so the UI still reflects the save
      return view
    }
  },

  /**
   * Delete a saved view by ID. Removes from both API and localStorage.
   */
  async deleteView(
    userId: string,
    dashboard: DashboardType,
    viewId: string,
  ): Promise<void> {
    const local = readLocalViews(userId, dashboard).filter(
      (v) => v.id !== viewId,
    )
    writeLocalViews(userId, dashboard, local)

    try {
      await deleteViewFromAPI(userId, viewId)
    } catch {
      // offline — localStorage already updated
    }
  },

  /**
   * Mark a saved view as the default for its dashboard type. Only one
   * default per dashboard is allowed; clears `isDefault` on all others.
   */
  async setDefaultView(
    userId: string,
    dashboard: DashboardType,
    viewId: string,
  ): Promise<void> {
    const local = readLocalViews(userId, dashboard)
    for (const v of local) v.isDefault = v.id === viewId
    writeLocalViews(userId, dashboard, local)

    try {
      await setDefaultViewAPI(userId, dashboard, viewId)
    } catch {
      // offline — localStorage already updated
    }
  },
}
