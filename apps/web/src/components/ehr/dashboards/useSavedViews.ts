/**
 * React hook for managing dashboard saved views.
 *
 * Wraps {@link savedViewsService} with React state, loading/error tracking,
 * and automatic initial load when the dashboard type or user changes.
 *
 * @module useSavedViews
 */

import { useCallback, useEffect, useState } from 'react'

import { savedViewsService } from './saved-views-service'
import type { DashboardLayout, DashboardType } from './types'

export interface UseSavedViewsResult {
  views: DashboardLayout[]
  loading: boolean
  error: string | null
  saveView: (view: DashboardLayout) => Promise<DashboardLayout>
  deleteView: (viewId: string) => Promise<void>
  setDefaultView: (viewId: string) => Promise<void>
  refresh: () => void
}

export function useSavedViews(
  userId: string,
  dashboard: DashboardType,
): UseSavedViewsResult {
  const [views, setViews] = useState<DashboardLayout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const loaded = await savedViewsService.loadViews(userId, dashboard)
      setViews(loaded)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load saved views',
      )
    } finally {
      setLoading(false)
    }
  }, [userId, dashboard])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const loaded = await savedViewsService.loadViews(userId, dashboard)
        if (!cancelled) {
          setViews(loaded)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load saved views',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, dashboard])

  const saveView = useCallback(
    async (view: DashboardLayout): Promise<DashboardLayout> => {
      const saved = await savedViewsService.saveView(userId, dashboard, view)
      setViews((prev) => {
        const idx = prev.findIndex((v) => v.id === saved.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = saved
          return next
        }
        return [...prev, saved]
      })
      return saved
    },
    [userId, dashboard],
  )

  const deleteView = useCallback(
    async (viewId: string): Promise<void> => {
      await savedViewsService.deleteView(userId, dashboard, viewId)
      setViews((prev) => prev.filter((v) => v.id !== viewId))
    },
    [userId, dashboard],
  )

  const setDefaultView = useCallback(
    async (viewId: string): Promise<void> => {
      await savedViewsService.setDefaultView(userId, dashboard, viewId)
      setViews((prev) =>
        prev.map((v) => ({ ...v, isDefault: v.id === viewId })),
      )
    },
    [userId, dashboard],
  )

  return {
    views,
    loading,
    error,
    saveView,
    deleteView,
    setDefaultView,
    refresh,
  }
}
