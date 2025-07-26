/* global vi, describe, it, expect, beforeEach */
import { NotificationChannel } from '@/lib/services/notification/NotificationService'
import { act, renderHook } from '@testing-library/react'
import { useNotificationPreferences } from '../useNotificationPreferences'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('useNotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads preferences on mount', async () => {
    const mockPreferences = {
      channels: {
        [NotificationChannel.IN_APP]: true,
        [NotificationChannel.EMAIL]: false,
        [NotificationChannel.PUSH]: true,
        [NotificationChannel.SMS]: false,
      },
      frequency: 'batched',
      quiet_hours: {
        enabled: true,
        start: '23:00',
        end: '06:00',
      },
      categories: {
        system: true,
        security: false,
      },
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPreferences),
    })

    const { result } = renderHook(() => useNotificationPreferences())

    // Initially loading
    expect(result.current.isLoading).toBe(true)

    // Wait for preferences to load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.preferences).toEqual(mockPreferences)
    expect(result.current.error).toBeNull()
  })

  it('falls back to default preferences on load error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useNotificationPreferences())

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.preferences).toEqual(
      expect.objectContaining({
        channels: expect.objectContaining({
          [NotificationChannel.IN_APP]: true,
          [NotificationChannel.EMAIL]: true,
          [NotificationChannel.PUSH]: false,
          [NotificationChannel.SMS]: false,
        }),
      }),
    )
  })

  it('updates channel preferences', async () => {
    const { result } = renderHook(() => useNotificationPreferences())

    // Wait for initial load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          ...result.current.preferences,
          channels: {
            ...result.current.preferences.channels,
            [NotificationChannel.EMAIL]: false,
          },
        }),
    })

    await act(async () => {
      await result.current.updateChannel(NotificationChannel.EMAIL, false)
    })

    expect(result.current.preferences.channels[NotificationChannel.EMAIL]).toBe(
      false,
    )
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/user/notification-preferences',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"email":false'),
      }),
    )
  })

  it('updates frequency preference', async () => {
    const { result } = renderHook(() => useNotificationPreferences())

    // Wait for initial load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          ...result.current.preferences,
          frequency: 'daily',
        }),
    })

    await act(async () => {
      await result.current.updateFrequency('daily')
    })

    expect(result.current.preferences.frequency).toBe('daily')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/user/notification-preferences',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"frequency":"daily"'),
      }),
    )
  })

  it('updates quiet hours preferences', async () => {
    const { result } = renderHook(() => useNotificationPreferences())

    // Wait for initial load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const newQuietHours = {
      enabled: true,
      start: '21:00',
      end: '08:00',
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          ...result.current.preferences,
          quiet_hours: newQuietHours,
        }),
    })

    await act(async () => {
      await result.current.updateQuietHours(newQuietHours)
    })

    expect(result.current.preferences.quiet_hours).toEqual(newQuietHours)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/user/notification-preferences',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining(
          '"quiet_hours":{"enabled":true,"start":"21:00","end":"08:00"}',
        ),
      }),
    )
  })

  it('updates category preferences', async () => {
    const { result } = renderHook(() => useNotificationPreferences())

    // Wait for initial load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          ...result.current.preferences,
          categories: {
            ...result.current.preferences.categories,
            updates: false,
          },
        }),
    })

    await act(async () => {
      await result.current.updateCategory('updates', false)
    })

    expect(result.current.preferences.categories.updates).toBe(false)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/user/notification-preferences',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"updates":false'),
      }),
    )
  })

  it('handles update errors', async () => {
    const { result } = renderHook(() => useNotificationPreferences())

    // Wait for initial load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const initialPreferences = { ...result.current.preferences }
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    await act(async () => {
      await result.current.updateChannel(NotificationChannel.EMAIL, false)
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.preferences).toEqual(initialPreferences)
  })
})
