import { renderHook, act } from '@testing-library/react'
import { useTherapistAnalytics } from '../useTherapistAnalytics'
import type { TherapistSession } from '@/types/dashboard'
import { describe, expect, it, vi } from 'vitest'

// Mock the logger
vi.mock('@/lib/logging/build-safe-logger', () => ({
  createBuildSafeLogger: () => vi.fn(),
}))

describe('useTherapistAnalytics', () => {
  const mockSessions: TherapistSession[] = [
    {
      id: 'session-1',
      clientId: 'client-1',
      therapistId: 'therapist-1',
      startTime: '2026-01-01T10:00:00Z',
      endTime: '2026-01-01T11:00:00Z',
      status: 'completed',
      progress: 85,
      progressMetrics: {
        totalMessages: 42,
        therapistMessages: 21,
        clientMessages: 21,
        sessionDuration: 3600,
        activeTime: 3000,
        skillScores: {
          'Active Listening': 85,
          'Empathy': 78,
        },
        responseTime: 2.5,
        conversationFlow: 88,
        milestonesReached: ['introduction', 'exploration'],
        responsesCount: 0,
      },
    },
    {
      id: 'session-2',
      clientId: 'client-2',
      therapistId: 'therapist-1',
      startTime: '2026-01-02T10:00Z',
      status: 'active' as const,
      progress: 60,
      progressMetrics: {
        totalMessages: 25,
        therapistMessages: 15,
        clientMessages: 10,
        sessionDuration: 1800,
        activeTime: 1500,
        skillScores: {
          'Active Listening': 90,
          'Empathy': 82,
        },
        responseTime: 2.1,
        conversationFlow: 92,
        milestonesReached: ['introduction'],
        responsesCount: 0,
      },
    },
  ]

  const mockFilters = { timeRange: '30d' as const }

  it('initializes with loading state', async () => {
    const { result } = renderHook(() =>
      useTherapistAnalytics(mockFilters, mockSessions),
    )

    // Wait for initial load to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).not.toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('loads data successfully', async () => {
    const { result } = renderHook(() =>
      useTherapistAnalytics(mockFilters, mockSessions),
    )

    // Wait for data to load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).not.toBeNull()
    expect(result.current.error).toBeNull()

    // Check that data is properly transformed
    expect(result.current.data?.sessionMetrics).toHaveLength(2)
    expect(result.current.data?.skillProgress).toHaveLength(2)
    expect(result.current.data?.summaryStats).toHaveLength(4)
  })

  it('transforms session data correctly', async () => {
    const { result } = renderHook(() =>
      useTherapistAnalytics(mockFilters, mockSessions),
    )

    // Wait for data to load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const sessionMetrics = result.current.data?.sessionMetrics
    expect(sessionMetrics).toBeDefined()
    expect(sessionMetrics?.[0]?.sessionId).toBe('session-1')
    expect(sessionMetrics?.[0]?.averageSessionProgress).toBe(85)
    expect(sessionMetrics?.[0]?.milestonesAchieved).toBe(2)
  })

  it('transforms skill progress data correctly', async () => {
    const { result } = renderHook(() =>
      useTherapistAnalytics(mockFilters, mockSessions),
    )

    // Wait for data to load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const skillProgress = result.current.data?.skillProgress
    expect(skillProgress).toBeDefined()

    const activeListening = skillProgress?.find(
      (s) => s.skill === 'Active Listening',
    )
    expect(activeListening).toBeDefined()
    expect(activeListening?.score).toBe(88) // Average of 85 and 90
    expect(activeListening?.sessionsPracticed).toBe(2)
  })

  it('generates summary stats correctly', async () => {
    const { result } = renderHook(() =>
      useTherapistAnalytics(mockFilters, mockSessions),
    )

    // Wait for data to load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const summaryStats = result.current.data?.summaryStats
    expect(summaryStats).toBeDefined()

    const totalSessions = summaryStats?.find(
      (s) => s.label === 'Total Sessions',
    )
    expect(totalSessions?.value).toBe(2)

    const avgProgress = summaryStats?.find((s) => s.label === 'Avg Progress')
    expect(avgProgress?.value).toBe(73) // Average of 85 and 60
  })

  it('generates comparative data correctly', async () => {
    const { result } = renderHook(() =>
      useTherapistAnalytics(mockFilters, mockSessions),
    )

    // Wait for data to load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const comparativeData = result.current.data?.comparativeData
    expect(comparativeData).toBeDefined()
    expect(comparativeData?.trend).toBe('declining') // session-1 (85) vs session-2 (60) - declining
    // sessions are sorted by startTime descending, so the most recent session (session-2)
    // should be considered the current session and the older one (session-1) the previous
    expect(comparativeData?.currentSession.sessionId).toBe('session-2')
    expect(comparativeData?.previousSession?.sessionId).toBe('session-1')
  })

  it('handles empty sessions array', async () => {
    const emptySessions: TherapistSession[] = []
    const { result } = renderHook(() => useTherapistAnalytics(mockFilters, emptySessions))

    // Wait for data to load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).not.toBeNull()
    expect(result.current.data?.sessionMetrics).toHaveLength(0)
    expect(result.current.data?.skillProgress).toHaveLength(0)
  })

  it('handles refetch function', async () => {
    const { result } = renderHook(() =>
      useTherapistAnalytics(mockFilters, mockSessions),
    )

    // Wait for initial load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    await act(async () => {
      await result.current.refetch()
    })

    // Data should be regenerated
    expect(result.current.data).not.toBeNull()
  })

  it('clears error state', async () => {
    const { result } = renderHook(() =>
      useTherapistAnalytics(mockFilters, mockSessions),
    )

    // Wait for data to load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    act(() => {
      result.current.clearError()
    })

    expect(result.current.error).toBeNull()
  })

  it('responds to session changes', async () => {
    const { result, rerender } = renderHook(
      ({ sessions }) => useTherapistAnalytics(mockFilters, sessions),
      { initialProps: { sessions: mockSessions } },
    )

    // Wait for initial load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    // Rerender with different sessions
    const updatedSessions: TherapistSession[] = [...mockSessions]
    const newSession: TherapistSession = {
      id: 'session-3',
      clientId: 'client-3',
      therapistId: 'therapist-1',
      startTime: '2026-01-03T10:00Z',
      status: 'completed' as const,
      progress: 95,
      progressMetrics: {
        totalMessages: 30,
        therapistMessages: 18,
        clientMessages: 12,
        sessionDuration: 2000,
        activeTime: 1800,
        skillScores: {
          'Active Listening': 95,
          'Empathy': 88,
        },
        responseTime: 1.8,
        conversationFlow: 95,
        milestonesReached: ['introduction', 'exploration', 'closure'],
        responsesCount: 0,
      },
    }
    updatedSessions.push(newSession)

    rerender({ sessions: updatedSessions })

    // Wait for re-render to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(result.current.data?.sessionMetrics).toHaveLength(3)
  })

  it('transforms summary stats with trends', async () => {
    const { result } = renderHook(() =>
      useTherapistAnalytics(mockFilters, mockSessions),
    )

    // Wait for data to load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const summaryStats = result.current.data?.summaryStats
    expect(summaryStats).toBeDefined()

    // Check that trends are properly calculated
    const totalSessions = summaryStats?.find(
      (s) => s.label === 'Total Sessions',
    )
    expect(totalSessions?.trend).toBeDefined()

    const avgProgress = summaryStats?.find((s) => s.label === 'Avg Progress')
    expect(avgProgress?.trend).toBeDefined()
  })

  it('handles single session for comparative data', async () => {
    const singleSession = [mockSessions[0]].filter(
      Boolean,
    ) as TherapistSession[]
    const { result } = renderHook(() =>
      useTherapistAnalytics(mockFilters, singleSession),
    )

    // Wait for data to load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const comparativeData = result.current.data?.comparativeData
    expect(comparativeData).toBeUndefined()
  })

  it('handles filters correctly', async () => {
    const filters = { timeRange: '7d' as const }
    const { result } = renderHook(() =>
      useTherapistAnalytics(filters, mockSessions),
    )

    // Wait for data to load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(result.current.data).not.toBeNull()
  })
})
