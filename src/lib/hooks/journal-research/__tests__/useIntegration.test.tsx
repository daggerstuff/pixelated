import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import {
    useIntegrationPlanListQuery,
    useIntegrationPlanQuery,
    useIntegrationInitiateMutation,
    useIntegrationSelection,
} from '../useIntegration'
import * as api from '@/lib/api/journal-research'
import { useIntegrationStore } from '@/lib/stores/journal-research'

// Mock API functions
vi.mock('@/lib/api/journal-research', () => ({
    listIntegrationPlans: vi.fn(),
    getIntegrationPlan: vi.fn(),
    initiateIntegration: vi.fn(),
}))

// Mock store
vi.mock('@/lib/stores/journal-research', () => ({
    useIntegrationStore: vi.fn(),
}))

const mockIntegrationPlan = {
    planId: 'plan-1',
    sessionId: 'session-1',
    targetFormat: 'jsonl' as const,
    complexity: 'medium' as const,
    estimatedEffortHours: 8,
    preprocessingSteps: [],
    transformationRules: [],
    qualityChecks: [],
    createdAt: '2024-01-01T00:00:00Z',
}

const mockIntegrationPlanList = {
    items: [mockIntegrationPlan],
    total: 1,
    page: 1,
    pageSize: 25,
    totalPages: 1,
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

describe('useIntegration hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useIntegrationStore.mockReturnValue({
            filters: {
                targetFormats: [],
                complexityLevels: [],
                maxEffortHours: null,
            },
            selectedPlanId: null,
            setSelectedPlanId: vi.fn(),
            comparePlanIds: [],
            toggleComparePlanId: vi.fn(),
            clearCompare: vi.fn(),
        })
    })

    describe('useIntegrationPlanListQuery', () => {
        it('fetches integration plan list successfully', async () => {
            vi.mocked(api.listIntegrationPlans).mockResolvedValue(
                mockIntegrationPlanList,
            )

            const { result } = renderHook(
                () => useIntegrationPlanListQuery('session-1'),
                {
                    wrapper: createWrapper(),
                },
            )

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            expect(result.current.data).toBeDefined()
            expect(api.listIntegrationPlans).toHaveBeenCalledWith('session-1', {
                page: 1,
                pageSize: 25,
            })
        })

        it('applies filters from store', async () => {
            vi.mocked(api.listIntegrationPlans).mockResolvedValue(
                mockIntegrationPlanList,
            )
            useIntegrationStore.mockReturnValue({
                filters: {
                    targetFormats: ['jsonl'],
                    complexityLevels: ['medium'],
                    maxEffortHours: 10,
                },
            })

            const { result } = renderHook(
                () => useIntegrationPlanListQuery('session-1'),
                {
                    wrapper: createWrapper(),
                },
            )

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            expect(result.current.data).toBeDefined()
        })

        it('does not fetch when sessionId is null', () => {
            const { result } = renderHook(() => useIntegrationPlanListQuery(null), {
                wrapper: createWrapper(),
            })

            expect(result.current.isLoading).toBe(false)
            expect(api.listIntegrationPlans).not.toHaveBeenCalled()
        })

        it('handles error state', async () => {
            const error = new Error('Failed to fetch integration plans')
            vi.mocked(api.listIntegrationPlans).mockRejectedValue(error)

            const { result } = renderHook(
                () => useIntegrationPlanListQuery('session-1'),
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

    describe('useIntegrationPlanQuery', () => {
        it('fetches integration plan successfully', async () => {
            vi.mocked(api.getIntegrationPlan).mockResolvedValue(mockIntegrationPlan)

            const { result } = renderHook(
                () => useIntegrationPlanQuery('session-1', 'plan-1'),
                {
                    wrapper: createWrapper(),
                },
            )

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            expect(result.current.data).toEqual(mockIntegrationPlan)
            expect(api.getIntegrationPlan).toHaveBeenCalledWith('session-1', 'plan-1')
        })

        it('does not fetch when sessionId or planId is null', () => {
            const { result } = renderHook(
                () => useIntegrationPlanQuery(null, 'plan-1'),
                {
                    wrapper: createWrapper(),
                },
            )

            expect(result.current.isLoading).toBe(false)
            expect(api.getIntegrationPlan).not.toHaveBeenCalled()
        })

        it('handles error state', async () => {
            const error = new Error('Failed to fetch integration plan')
            vi.mocked(api.getIntegrationPlan).mockRejectedValue(error)

            const { result } = renderHook(
                () => useIntegrationPlanQuery('session-1', 'plan-1'),
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

    describe('useIntegrationInitiateMutation', () => {
        it('initiates integration successfully', async () => {
            vi.mocked(api.initiateIntegration).mockResolvedValue(mockIntegrationPlan)
            const setSelectedPlanId = vi.fn()

            vi.spyOn(useIntegrationStore, 'getState').mockReturnValue({
                setSelectedPlanId,
            } as any)

            const { result } = renderHook(
                () => useIntegrationInitiateMutation('session-1'),
                {
                    wrapper: createWrapper(),
                },
            )

            const payload = {
                acquisitionIds: ['acq-1'],
                targetFormat: 'jsonl' as const,
                options: {},
            }

            result.current.mutate(payload)

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            expect(api.initiateIntegration).toHaveBeenCalledWith('session-1', payload)
            expect(setSelectedPlanId).toHaveBeenCalledWith('plan-1')
        })

        it('handles error state', async () => {
            const error = new Error('Failed to initiate integration')
            vi.mocked(api.initiateIntegration).mockRejectedValue(error)

            const { result } = renderHook(
                () => useIntegrationInitiateMutation('session-1'),
                {
                    wrapper: createWrapper(),
                },
            )

            result.current.mutate({
                acquisitionIds: ['acq-1'],
                targetFormat: 'jsonl',
                options: {},
            })

            await waitFor(() => {
                expect(result.current.isError).toBe(true)
            })

            expect(result.current.error).toEqual(error)
        })
    })

    describe('useIntegrationSelection', () => {
        it('returns selection state from store', () => {
            const mockState = {
                selectedPlanId: 'plan-1',
                setSelectedPlanId: vi.fn(),
                comparePlanIds: ['plan-1', 'plan-2'],
                toggleComparePlanId: vi.fn(),
                clearCompare: vi.fn(),
            }

            useIntegrationStore.mockReturnValue(mockState)

            const { result } = renderHook(() => useIntegrationSelection())

            expect(result.current.selectedPlanId).toBe('plan-1')
            expect(result.current.comparePlanIds).toEqual(['plan-1', 'plan-2'])
            expect(typeof result.current.setSelectedPlanId).toBe('function')
            expect(typeof result.current.toggleComparePlanId).toBe('function')
            expect(typeof result.current.clearCompare).toBe('function')
        })
    })
})
