import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import {
    useProgressQuery,
    useProgressMetricsQuery,
    useInvalidateProgress,
} from '../useProgress'
import * as api from '@/lib/api/journal-research'

// Mock API functions
vi.mock('@/lib/api/journal-research', () => ({
    getProgress: vi.fn(),
    getProgressMetrics: vi.fn(),
}))

const mockProgress = {
    sessionId: 'session-1',
    currentPhase: 'discovery',
    progressPercentage: 45,
    progressMetrics: {
        sourcesIdentified: 10,
        datasetsEvaluated: 5,
        datasetsAcquired: 2,
    },
    weeklyTargets: {
        sources: 20,
        datasets: 10,
    },
}

const mockProgressMetrics = {
    sessionId: 'session-1',
    sourcesIdentified: 10,
    datasetsEvaluated: 5,
    datasetsAcquired: 2,
    integrationPlansCreated: 1,
    lastUpdated: '2024-01-01T00:00:00Z',
}

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    })

    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
}

describe('useProgress hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('useProgressQuery', () => {
        it('fetches progress successfully', async () => {
            vi.mocked(api.getProgress).mockResolvedValue(mockProgress)

            const { result } = renderHook(() => useProgressQuery('session-1'), {
                wrapper: createWrapper(),
            })

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            expect(result.current.data).toEqual(mockProgress)
            expect(api.getProgress).toHaveBeenCalledWith('session-1')
        })

        it('does not fetch when sessionId is null', () => {
            const { result } = renderHook(() => useProgressQuery(null), {
                wrapper: createWrapper(),
            })

            expect(result.current.isLoading).toBe(false)
            expect(api.getProgress).not.toHaveBeenCalled()
        })

        it('respects enabled option', () => {
            const { result } = renderHook(
                () => useProgressQuery('session-1', { enabled: false }),
                {
                    wrapper: createWrapper(),
                },
            )

            expect(result.current.isLoading).toBe(false)
            expect(api.getProgress).not.toHaveBeenCalled()
        })

        it('handles error state', async () => {
            const error = new Error('Failed to fetch progress')
            vi.mocked(api.getProgress).mockRejectedValue(error)

            const { result } = renderHook(() => useProgressQuery('session-1'), {
                wrapper: createWrapper(),
            })

            await waitFor(() => {
                expect(result.current.isError).toBe(true)
            })

            expect(result.current.error).toEqual(error)
        })
    })

    describe('useProgressMetricsQuery', () => {
        it('fetches progress metrics successfully', async () => {
            vi.mocked(api.getProgressMetrics).mockResolvedValue(mockProgressMetrics)

            const { result } = renderHook(
                () => useProgressMetricsQuery('session-1'),
                {
                    wrapper: createWrapper(),
                },
            )

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            expect(result.current.data).toEqual(mockProgressMetrics)
            expect(api.getProgressMetrics).toHaveBeenCalledWith('session-1')
        })

        it('supports refetchInterval', () => {
            const { result } = renderHook(
                () =>
                    useProgressMetricsQuery('session-1', { refetchInterval: 5000 }),
                {
                    wrapper: createWrapper(),
                },
            )

            expect(result.current.data).toBeDefined()
            // The refetchInterval should be set in the query options
        })

        it('does not fetch when sessionId is null', () => {
            const { result } = renderHook(() => useProgressMetricsQuery(null), {
                wrapper: createWrapper(),
            })

            expect(result.current.isLoading).toBe(false)
            expect(api.getProgressMetrics).not.toHaveBeenCalled()
        })

        it('handles error state', async () => {
            const error = new Error('Failed to fetch progress metrics')
            vi.mocked(api.getProgressMetrics).mockRejectedValue(error)

            const { result } = renderHook(
                () => useProgressMetricsQuery('session-1'),
                {
                    wrapper: createWrapper(),
                },
            )

            await waitFor(() => {
                expect(result.current.isError).toBe(true)
            })

            expect(result.current.error).toEqual(error)
        })
    })

    describe('useInvalidateProgress', () => {
        it('invalidates progress queries', () => {
            const queryClient = new QueryClient({
                defaultOptions: {
                    queries: { retry: false },
                },
            })

            const wrapper = ({ children }: { children: ReactNode }) => (
                <QueryClientProvider client={queryClient}>
                    {children}
                </QueryClientProvider>
            )

            const { result } = renderHook(() => useInvalidateProgress(), {
                wrapper,
            })

            const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

            result.current('session-1')

            expect(invalidateSpy).toHaveBeenCalledTimes(2)
        })
    })
})
