import { create } from 'zustand'

export type EvaluationSortField =
  | 'therapeutic_relevance'
  | 'data_structure_quality'
  | 'training_integration'
  | 'ethical_accessibility'
  | 'overall_score'
  | 'evaluation_date'

interface EvaluationFilters {
  priorityTiers: string[]
  minimumScore: number | null
  maximumScore: number | null
  sortBy: EvaluationSortField
  sortDirection: 'asc' | 'desc'
}

interface EvaluationStoreState {
  selectedEvaluationId: string | null
  editingEvaluationId: string | null
  filters: EvaluationFilters
  isBulkEditMode: boolean

  setSelectedEvaluationId: (evaluationId: string | null) => void
  setEditingEvaluationId: (evaluationId: string | null) => void
  togglePriorityTier: (priorityTier: string) => void
  setScoreRange: (min: number | null, max: number | null) => void
  setSort: (sortBy: EvaluationSortField, sortDirection?: 'asc' | 'desc') => void
  toggleBulkEditMode: () => void
  resetFilters: () => void
}

const defaultFilters: EvaluationFilters = {
  priorityTiers: [],
  minimumScore: null,
  maximumScore: null,
  sortBy: 'overall_score',
  sortDirection: 'desc',
}

export const useEvaluationStore = create<EvaluationStoreState>((set) => ({
  selectedEvaluationId: null,
  editingEvaluationId: null,
  filters: defaultFilters,
  isBulkEditMode: false,

  setSelectedEvaluationId: (evaluationId) =>
    set({ selectedEvaluationId: evaluationId }),

  setEditingEvaluationId: (evaluationId) =>
    set({ editingEvaluationId: evaluationId }),

  togglePriorityTier: (priorityTier) =>
    set((state) => {
      const priorityTiers = state.filters.priorityTiers.includes(priorityTier)
        ? state.filters.priorityTiers.filter(
            (existing) => existing !== priorityTier,
          )
        : [...state.filters.priorityTiers, priorityTier]

      return {
        filters: {
          ...state.filters,
          priorityTiers,
        },
      }
    }),

  setScoreRange: (min, max) =>
    set((state) => ({
      filters: {
        ...state.filters,
        minimumScore: min,
        maximumScore: max,
      },
    })),

  setSort: (sortBy, sortDirection) =>
    set((state) => ({
      filters: {
        ...state.filters,
        sortBy,
        sortDirection: sortDirection ?? state.filters.sortDirection,
      },
    })),

  toggleBulkEditMode: () =>
    set((state) => ({ isBulkEditMode: !state.isBulkEditMode })),

  resetFilters: () => set({ filters: defaultFilters }),
}))


