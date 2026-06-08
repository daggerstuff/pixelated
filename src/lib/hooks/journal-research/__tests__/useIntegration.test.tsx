import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import type {
  IntegrationPlan,
  IntegrationPlanList,
} from '@/lib/api/journal-research'
import * as api from '@/lib/api/journal-research'
import { useIntegrationStore } from '@/lib/stores/journal-research'

import {
  useIntegrationPlanListQuery,
  useIntegrationPlanQuery,
  useIntegrationInitiateMutation,
  useIntegrationSelection,
} from '../useIntegration'

// Mock API functions
vi.mock('@/lib/api/journal-research', () => ({
  listIntegrationPlans: vi.fn<() => Promise<IntegrationPlanList>>(),
  getIntegrationPlan: vi.fn<() => Promise<IntegrationPlan>>(),
  initiateIntegration: vi.fn<() => Promise<IntegrationPlan>>(),
}))

// Mock store
vi.mock('@/lib/stores/journal-research', () => ({
  useIntegrationStore: vi.fn<() => unknown>(),
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
  const baseStoreState = {
    filters: {
      targetFormats: [],
      complexityLevels: [],
      maxEffortHours: null,
    },
    selectedPlanId: null,
    setSelectedPlanId: vi.fn<(id: string | null) => void>(),
    comparePlanIds: [],
    toggleComparePlanId: vi.fn<(id: string) => void>(),
    clearCompare: vi.fn<() => void>(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    const storeState = {
      ...baseStoreState,
      setSelectedPlanId: vi.fn<(id: string | null) => void>(),
      toggleComparePlanId: vi.fn<(id: string) => void>(),
      clearCompare: vi.fn<() => void>(),
    }
    useIntegrationStore.mockImplementation(
      (selector?: (state: typeof storeState) => unknown) =>
        typeof selector === 'function' ? selector(storeState) : storeState,
    )
    ;(
      useIntegrationStore as typeof useIntegrationStore & {
        getState?: () => typeof storeState
      }
    ).getState = () => storeState
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
      const filteredStoreState = {
        ...baseStoreState,
        filters: {
          targetFormats: ['jsonl'],
          complexityLevels: ['medium'],
          maxEffortHours: 10,
        },
      }
      useIntegrationStore.mockImplementation(
        (selector?: (state: typeof filteredStoreState) => unknown) =>
          typeof selector === 'function'
            ? selector(filteredStoreState)
            : filteredStoreState,
      )
      ;(
        useIntegrationStore as typeof useIntegrationStore & {
          getState?: () => typeof filteredStoreState
        }
      ).getState = () => filteredStoreState

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
      const setSelectedPlanId = vi.fn<(id: string) => void>()

      ;(
        useIntegrationStore as typeof useIntegrationStore & {
          getState?: () => { setSelectedPlanId: typeof setSelectedPlanId }
        }
      ).getState = () => ({
        setSelectedPlanId,
      })

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
        setSelectedPlanId: vi.fn<(id: string | null) => void>(),
        comparePlanIds: ['plan-1', 'plan-2'],
        toggleComparePlanId: vi.fn<(id: string) => void>(),
        clearCompare: vi.fn<() => void>(),
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
