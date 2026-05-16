import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { Evaluation, EvaluationList } from '@/lib/api/journal-research'
import * as api from '@/lib/api/journal-research'
import { useEvaluationStore } from '@/lib/stores/journal-research'

import {
  useEvaluationListQuery,
  useEvaluationQuery,
  useEvaluationInitiateMutation,
  useEvaluationUpdateMutation,
  useEvaluationSelection,
} from '../useEvaluation'

// Mock API functions
vi.mock('@/lib/api/journal-research', () => ({
  listEvaluations: vi.fn<() => Promise<EvaluationList>>(),
  getEvaluation: vi.fn<() => Promise<Evaluation>>(),
  initiateEvaluation: vi.fn<() => Promise<Evaluation>>(),
  updateEvaluation: vi.fn<() => Promise<Evaluation>>(),
}))

// Mock store
vi.mock('@/lib/stores/journal-research', () => ({
  useEvaluationStore: vi.fn<() => unknown>(),
}))

const mockEvaluation = {
  evaluationId: 'eval-1',
  sessionId: 'session-1',
  sourceId: 'source-1',
  priorityTier: 'high' as const,
  overallScore: 0.85,
  therapeuticRelevance: 0.9,
  dataStructureQuality: 0.8,
  trainingIntegration: 0.85,
  ethicalAccessibility: 0.8,
  evaluationDate: '2024-01-01T00:00:00Z',
  notes: 'Test evaluation',
}

const mockEvaluationList = {
  items: [mockEvaluation],
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

describe('useEvaluation hooks', () => {
  const baseStoreState = {
    filters: {
      priorityTiers: [],
      minimumScore: null,
      maximumScore: null,
      sortBy: 'overall_score',
      sortDirection: 'desc',
    },
    selectedEvaluationId: null,
    setSelectedEvaluationId: vi.fn<(id: string | null) => void>(),
    editingEvaluationId: null,
    setEditingEvaluationId: vi.fn<(id: string | null) => void>(),
    isBulkEditMode: false,
    toggleBulkEditMode: vi.fn<() => void>(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    const storeState = {
      ...baseStoreState,
      setSelectedEvaluationId: vi.fn<(id: string | null) => void>(),
      setEditingEvaluationId: vi.fn<(id: string | null) => void>(),
      toggleBulkEditMode: vi.fn<() => void>(),
    }
    useEvaluationStore.mockImplementation(
      (selector?: (state: typeof storeState) => unknown) =>
        typeof selector === 'function' ? selector(storeState) : storeState,
    )
    ;(
      useEvaluationStore as typeof useEvaluationStore & {
        getState?: () => typeof storeState
      }
    ).getState = () => storeState
  })

  describe('useEvaluationListQuery', () => {
    it('fetches evaluation list successfully', async () => {
      vi.mocked(api.listEvaluations).mockResolvedValue(mockEvaluationList)

      const { result } = renderHook(() => useEvaluationListQuery('session-1'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toBeDefined()
      expect(api.listEvaluations).toHaveBeenCalledWith('session-1', {
        page: 1,
        pageSize: 25,
      })
    })

    it('applies filters from store', async () => {
      vi.mocked(api.listEvaluations).mockResolvedValue(mockEvaluationList)
      const filteredStoreState = {
        ...baseStoreState,
        filters: {
          priorityTiers: ['high'],
          minimumScore: 0.8,
          maximumScore: 0.9,
          sortBy: 'therapeutic_relevance',
          sortDirection: 'asc',
        },
      }
      useEvaluationStore.mockImplementation(
        (selector?: (state: typeof filteredStoreState) => unknown) =>
          typeof selector === 'function'
            ? selector(filteredStoreState)
            : filteredStoreState,
      )
      ;(
        useEvaluationStore as typeof useEvaluationStore & {
          getState?: () => typeof filteredStoreState
        }
      ).getState = () => filteredStoreState

      const { result } = renderHook(() => useEvaluationListQuery('session-1'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toBeDefined()
    })

    it('does not fetch when sessionId is null', () => {
      const { result } = renderHook(() => useEvaluationListQuery(null), {
        wrapper: createWrapper(),
      })

      expect(result.current.isLoading).toBe(false)
      expect(api.listEvaluations).not.toHaveBeenCalled()
    })

    it('handles error state', async () => {
      const error = new Error('Failed to fetch evaluations')
      vi.mocked(api.listEvaluations).mockRejectedValue(error)

      const { result } = renderHook(() => useEvaluationListQuery('session-1'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(error)
    })
  })

  describe('useEvaluationQuery', () => {
    it('fetches evaluation successfully', async () => {
      vi.mocked(api.getEvaluation).mockResolvedValue(mockEvaluation)

      const { result } = renderHook(
        () => useEvaluationQuery('session-1', 'eval-1'),
        {
          wrapper: createWrapper(),
        },
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockEvaluation)
      expect(api.getEvaluation).toHaveBeenCalledWith('session-1', 'eval-1')
    })

    it('does not fetch when sessionId or evaluationId is null', () => {
      const { result } = renderHook(() => useEvaluationQuery(null, 'eval-1'), {
        wrapper: createWrapper(),
      })

      expect(result.current.isLoading).toBe(false)
      expect(api.getEvaluation).not.toHaveBeenCalled()
    })

    it('handles error state', async () => {
      const error = new Error('Failed to fetch evaluation')
      vi.mocked(api.getEvaluation).mockRejectedValue(error)

      const { result } = renderHook(
        () => useEvaluationQuery('session-1', 'eval-1'),
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

  describe('useEvaluationInitiateMutation', () => {
    it('initiates evaluation successfully', async () => {
      vi.mocked(api.initiateEvaluation).mockResolvedValue(mockEvaluation)
      const setSelectedEvaluationId = vi.fn<(id: string) => void>()

      ;(
        useEvaluationStore as typeof useEvaluationStore & {
          getState?: () => {
            setSelectedEvaluationId: typeof setSelectedEvaluationId
          }
        }
      ).getState = () => ({
        setSelectedEvaluationId,
      })

      const { result } = renderHook(
        () => useEvaluationInitiateMutation('session-1'),
        {
          wrapper: createWrapper(),
        },
      )

      const payload = {
        sourceIds: ['source-1'],
        evaluationCriteria: {},
      }

      result.current.mutate(payload)

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(api.initiateEvaluation).toHaveBeenCalledWith('session-1', payload)
      expect(setSelectedEvaluationId).toHaveBeenCalledWith('eval-1')
    })

    it('handles error state', async () => {
      const error = new Error('Failed to initiate evaluation')
      vi.mocked(api.initiateEvaluation).mockRejectedValue(error)

      const { result } = renderHook(
        () => useEvaluationInitiateMutation('session-1'),
        {
          wrapper: createWrapper(),
        },
      )

      result.current.mutate({
        sourceIds: ['source-1'],
        evaluationCriteria: {},
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(error)
    })
  })

  describe('useEvaluationUpdateMutation', () => {
    it('updates evaluation successfully', async () => {
      const updatedEvaluation = { ...mockEvaluation, notes: 'Updated notes' }
      vi.mocked(api.updateEvaluation).mockResolvedValue(updatedEvaluation)

      const { result } = renderHook(
        () => useEvaluationUpdateMutation('session-1'),
        {
          wrapper: createWrapper(),
        },
      )

      const payload = {
        notes: 'Updated notes',
      }

      result.current.mutate({ evaluationId: 'eval-1', payload })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(api.updateEvaluation).toHaveBeenCalledWith(
        'session-1',
        'eval-1',
        payload,
      )
    })

    it('handles error state', async () => {
      const error = new Error('Failed to update evaluation')
      vi.mocked(api.updateEvaluation).mockRejectedValue(error)

      const { result } = renderHook(
        () => useEvaluationUpdateMutation('session-1'),
        {
          wrapper: createWrapper(),
        },
      )

      result.current.mutate({
        evaluationId: 'eval-1',
        payload: { notes: 'Updated' },
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(error)
    })
  })

  describe('useEvaluationSelection', () => {
    it('returns selection state from store', () => {
      const mockState = {
        selectedEvaluationId: 'eval-1',
        setSelectedEvaluationId: vi.fn<(id: string | null) => void>(),
        editingEvaluationId: 'eval-2',
        setEditingEvaluationId: vi.fn<(id: string | null) => void>(),
        isBulkEditMode: true,
        toggleBulkEditMode: vi.fn<() => void>(),
      }

      useEvaluationStore.mockReturnValue(mockState)

      const { result } = renderHook(() => useEvaluationSelection())

      expect(result.current.selectedEvaluationId).toBe('eval-1')
      expect(result.current.editingEvaluationId).toBe('eval-2')
      expect(result.current.isBulkEditMode).toBe(true)
      expect(typeof result.current.setSelectedEvaluationId).toBe('function')
      expect(typeof result.current.toggleBulkEditMode).toBe('function')
    })
  })
})
