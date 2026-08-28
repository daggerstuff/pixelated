/**
 * Tests for saved views service (PIX-4413)
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

import { savedViewsService } from '@/components/ehr/dashboards/saved-views-service'
import type { DashboardLayout } from '@/components/ehr/dashboards/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createLayout(
  id: string,
  dashboard: string = 'practice',
): DashboardLayout {
  return {
    id,
    name: `Layout ${id}`,
    dashboard: dashboard as never,
    isDefault: false,
    isShared: false,
    ownerId: 'user-1',
    widgets: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('savedViewsService', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value)
        },
        removeItem: (key: string) => {
          store.delete(key)
        },
        clear: () => {
          store.clear()
        },
        length: 0,
        key: (index: number) => Array.from(store.keys())[index] ?? null,
      },
      writable: true,
      configurable: true,
    })
    vi.restoreAllMocks()
  })

  // ---- loadViews ----

  describe('loadViews', () => {
    it('returns views from API on success', async () => {
      const mockViews = [createLayout('v1'), createLayout('v2')]
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { views: mockViews } }),
      }) as never

      const views = await savedViewsService.loadViews('user-1', 'practice')
      expect(views).toHaveLength(2)
      expect(views[0].id).toBe('v1')
    })

    it('falls back to localStorage when API fails', async () => {
      const localViews = [createLayout('local-1')]
      localStorage.setItem(
        'ehr-dashboard-views:user-1:practice',
        JSON.stringify(localViews),
      )

      global.fetch = vi
        .fn()
        .mockRejectedValue(new Error('Network error')) as never

      const views = await savedViewsService.loadViews('user-1', 'practice')
      expect(views).toHaveLength(1)
      expect(views[0].id).toBe('local-1')
    })

    it('returns empty array when API fails and localStorage is empty', async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValue(new Error('Network error')) as never
      const views = await savedViewsService.loadViews('user-1', 'practice')
      expect(views).toEqual([])
    })

    it('returns empty array when API returns ok but no views', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { views: [] } }),
      }) as never
      const views = await savedViewsService.loadViews('user-1', 'practice')
      expect(views).toEqual([])
    })
  })

  // ---- saveView ----

  describe('saveView', () => {
    it('saves via API and mirrors to localStorage', async () => {
      const view = createLayout('new-1')
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: view }),
      }) as never

      const result = await savedViewsService.saveView(
        'user-1',
        'practice',
        view,
      )
      expect(result.id).toBe('new-1')

      // localStorage should contain the view
      const stored = JSON.parse(
        localStorage.getItem('ehr-dashboard-views:user-1:practice') ?? '[]',
      ) as DashboardLayout[]
      expect(stored).toHaveLength(1)
      expect(stored[0].id).toBe('new-1')
    })

    it('updates existing view in localStorage rather than adding duplicate', async () => {
      const existing = createLayout('v1', 'practice')
      existing.name = 'Original'
      localStorage.setItem(
        'ehr-dashboard-views:user-1:practice',
        JSON.stringify([existing]),
      )

      const updated = { ...existing, name: 'Updated' }
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: updated }),
      }) as never

      await savedViewsService.saveView('user-1', 'practice', updated)

      const stored = JSON.parse(
        localStorage.getItem('ehr-dashboard-views:user-1:practice') ?? '[]',
      ) as DashboardLayout[]
      expect(stored).toHaveLength(1)
      expect(stored[0].name).toBe('Updated')
    })

    it('falls back to returning the local copy when API fails', async () => {
      const view = createLayout('offline-1')
      global.fetch = vi
        .fn()
        .mockRejectedValue(new Error('Network error')) as never

      const result = await savedViewsService.saveView(
        'user-1',
        'practice',
        view,
      )
      expect(result.id).toBe('offline-1')
    })
  })

  // ---- deleteView ----

  describe('deleteView', () => {
    it('removes view from localStorage', async () => {
      const views = [createLayout('v1'), createLayout('v2')]
      localStorage.setItem(
        'ehr-dashboard-views:user-1:practice',
        JSON.stringify(views),
      )

      global.fetch = vi.fn().mockResolvedValue({ ok: true }) as never

      await savedViewsService.deleteView('user-1', 'practice', 'v1')

      const stored = JSON.parse(
        localStorage.getItem('ehr-dashboard-views:user-1:practice') ?? '[]',
      ) as DashboardLayout[]
      expect(stored).toHaveLength(1)
      expect(stored[0].id).toBe('v2')
    })

    it('does not throw when API fails', async () => {
      const views = [createLayout('v1')]
      localStorage.setItem(
        'ehr-dashboard-views:user-1:practice',
        JSON.stringify(views),
      )

      global.fetch = vi
        .fn()
        .mockRejectedValue(new Error('Network error')) as never

      await expect(
        savedViewsService.deleteView('user-1', 'practice', 'v1'),
      ).resolves.toBeUndefined()

      const stored = JSON.parse(
        localStorage.getItem('ehr-dashboard-views:user-1:practice') ?? '[]',
      ) as DashboardLayout[]
      expect(stored).toHaveLength(0)
    })
  })

  // ---- setDefaultView ----

  describe('setDefaultView', () => {
    it('sets isDefault on the matching view and clears others', async () => {
      const views = [createLayout('v1'), createLayout('v2'), createLayout('v3')]
      views[0].isDefault = true
      localStorage.setItem(
        'ehr-dashboard-views:user-1:practice',
        JSON.stringify(views),
      )

      global.fetch = vi.fn().mockResolvedValue({ ok: true }) as never

      await savedViewsService.setDefaultView('user-1', 'practice', 'v2')

      const stored = JSON.parse(
        localStorage.getItem('ehr-dashboard-views:user-1:practice') ?? '[]',
      ) as DashboardLayout[]
      expect(stored.find((v) => v.id === 'v1')?.isDefault).toBe(false)
      expect(stored.find((v) => v.id === 'v2')?.isDefault).toBe(true)
      expect(stored.find((v) => v.id === 'v3')?.isDefault).toBe(false)
    })

    it('does not throw when API fails', async () => {
      const views = [createLayout('v1')]
      localStorage.setItem(
        'ehr-dashboard-views:user-1:practice',
        JSON.stringify(views),
      )

      global.fetch = vi
        .fn()
        .mockRejectedValue(new Error('Network error')) as never

      await expect(
        savedViewsService.setDefaultView('user-1', 'practice', 'v1'),
      ).resolves.toBeUndefined()
    })
  })
})
