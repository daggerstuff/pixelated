import { act, renderHook, waitFor } from '@testing-library/react'

/* global vi, describe, it, expect, beforeEach */

vi.mock('../lib/services/notification/NotificationService', () => ({
  NotificationChannel: {
    IN_APP: 'in_app',
    EMAIL: 'email',
    PUSH: 'push',
    SMS: 'sms',
  },
}))

vi.mock('@/lib/services/notification/NotificationService', () => ({
  NotificationChannel: {
    IN_APP: 'in_app',
    EMAIL: 'email',
    PUSH: 'push',
    SMS: 'sms',
  },
}))

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    getAccessTokenSilently: vi.fn().mockResolvedValue('mock-token'),
  }),
}))

import { useNotificationPreferences } from '../useNotificationPreferences'

const NotificationChannel = {
  IN_APP: 'in_app',
  EMAIL: 'email',
  PUSH: 'push',
  SMS: 'sms',
} as const

// Mock fetch
const mockFetch = vi.fn<() => Promise<Response>>()
global.fetch = mockFetch

function createMockResponse(body: unknown): Response {
  return {
    ok: true,
    async json() {
      return body
    },
  } as unknown as Response
}

const defaultPreferences = {
  channels: {
    [NotificationChannel.IN_APP]: true,
    [NotificationChannel.EMAIL]: true,
    [NotificationChannel.PUSH]: false,
    [NotificationChannel.SMS]: false,
  },
  frequency: 'immediate',
  quiet_hours: {
    enabled: false,
    start: '22:00',
    end: '07:00',
  },
  categories: {
    system: true,
    security: true,
    updates: true,
    reminders: true,
  },
}

describe('useNotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue(createMockResponse(defaultPreferences))
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

    mockFetch.mockResolvedValueOnce(createMockResponse(mockPreferences))

    const { result } = renderHook(() => useNotificationPreferences())

    // Initially loading
    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.isLoading).toBe(false)
    expect(result.current.preferences).toEqual(mockPreferences)
    expect(result.current.error).toBeNull()
  })

  it('falls back to default preferences on load error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useNotificationPreferences())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

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
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        ...result.current.preferences,
        channels: {
          ...result.current.preferences.channels,
          [NotificationChannel.EMAIL]: false,
        },
      }),
    )

    await act(async () => {
      await result.current.updateChannel(NotificationChannel.EMAIL, false)
    })

    await waitFor(() =>
      expect(
        result.current.preferences.channels[NotificationChannel.EMAIL],
      ).toBe(false),
    )

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
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        ...result.current.preferences,
        frequency: 'daily',
      }),
    )

    await act(async () => {
      await result.current.updateFrequency('daily')
    })

    await waitFor(() =>
      expect(result.current.preferences.frequency).toBe('daily'),
    )

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
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const newQuietHours = {
      enabled: true,
      start: '21:00',
      end: '08:00',
    }

    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        ...result.current.preferences,
        quiet_hours: newQuietHours,
      }),
    )

    await act(async () => {
      await result.current.updateQuietHours(newQuietHours)
    })

    await waitFor(() =>
      expect(result.current.preferences.quiet_hours).toEqual(newQuietHours),
    )

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
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        ...result.current.preferences,
        categories: {
          ...result.current.preferences.categories,
          updates: false,
        },
      }),
    )

    await act(async () => {
      await result.current.updateCategory('updates', false)
    })

    await waitFor(() =>
      expect(result.current.preferences.categories['updates']).toBe(false),
    )

    expect(result.current.preferences.categories['updates']).toBe(false)
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
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const initialPreferences = { ...result.current.preferences }
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    await act(async () => {
      await result.current.updateChannel(NotificationChannel.EMAIL, false)
    })

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error))

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.preferences).toEqual(initialPreferences)
  })
})
