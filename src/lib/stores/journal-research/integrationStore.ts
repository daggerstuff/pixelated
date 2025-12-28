import { create } from 'zustand'

interface IntegrationFilters {
  targetFormats: string[]
  complexityLevels: string[]
  maxEffortHours: number | null
}

interface IntegrationStoreState {
  selectedPlanId: string | null
  filters: IntegrationFilters
  comparePlanIds: string[]

  setSelectedPlanId: (planId: string | null) => void
  toggleComparePlanId: (planId: string) => void
  toggleTargetFormat: (format: string) => void
  toggleComplexityLevel: (complexity: string) => void
  setMaxEffortHours: (hours: number | null) => void
  resetFilters: () => void
  clearCompare: () => void
}

const defaultFilters: IntegrationFilters = {
  targetFormats: [],
  complexityLevels: [],
  maxEffortHours: null,
}

export const useIntegrationStore = create<IntegrationStoreState>((set) => ({
  selectedPlanId: null,
  filters: defaultFilters,
  comparePlanIds: [],

  setSelectedPlanId: (planId) => set({ selectedPlanId: planId }),

  toggleComparePlanId: (planId) =>
    set((state) => {
      const comparePlanIds = state.comparePlanIds.includes(planId)
        ? state.comparePlanIds.filter((existing) => existing !== planId)
        : [...state.comparePlanIds, planId]

      return { comparePlanIds }
    }),

  toggleTargetFormat: (format) =>
    set((state) => {
      const targetFormats = state.filters.targetFormats.includes(format)
        ? state.filters.targetFormats.filter((existing) => existing !== format)
        : [...state.filters.targetFormats, format]

      return {
        filters: {
          ...state.filters,
          targetFormats,
        },
      }
    }),

  toggleComplexityLevel: (complexity) =>
    set((state) => {
      const complexityLevels = state.filters.complexityLevels.includes(
        complexity,
      )
        ? state.filters.complexityLevels.filter(
            (existing) => existing !== complexity,
          )
        : [...state.filters.complexityLevels, complexity]

      return {
        filters: {
          ...state.filters,
          complexityLevels,
        },
      }
    }),

  setMaxEffortHours: (hours) =>
    set((state) => ({
      filters: {
        ...state.filters,
        maxEffortHours: hours,
      },
    })),

  resetFilters: () => set({ filters: defaultFilters }),
  clearCompare: () => set({ comparePlanIds: [] }),
}))


