import { create } from 'zustand'

export type AcquisitionStatus =
  | 'pending'
  | 'approved'
  | 'in-progress'
  | 'completed'
  | 'failed'

interface AcquisitionFilters {
  statuses: AcquisitionStatus[]
  showDownloadFailuresOnly: boolean
}

interface AcquisitionStoreState {
  selectedAcquisitionId: string | null
  filters: AcquisitionFilters
  expandedRowIds: string[]

  setSelectedAcquisitionId: (acquisitionId: string | null) => void
  toggleStatusFilter: (status: AcquisitionStatus) => void
  toggleShowDownloadFailuresOnly: () => void
  expandRow: (acquisitionId: string) => void
  collapseRow: (acquisitionId: string) => void
  resetFilters: () => void
}

const defaultFilters: AcquisitionFilters = {
  statuses: [],
  showDownloadFailuresOnly: false,
}

export const useAcquisitionStore = create<AcquisitionStoreState>((set) => ({
  selectedAcquisitionId: null,
  filters: defaultFilters,
  expandedRowIds: [],

  setSelectedAcquisitionId: (acquisitionId) =>
    set({ selectedAcquisitionId: acquisitionId }),

  toggleStatusFilter: (status) =>
    set((state) => {
      const statuses = state.filters.statuses.includes(status)
        ? state.filters.statuses.filter((existing) => existing !== status)
        : [...state.filters.statuses, status]

      return {
        filters: {
          ...state.filters,
          statuses,
        },
      }
    }),

  toggleShowDownloadFailuresOnly: () =>
    set((state) => ({
      filters: {
        ...state.filters,
        showDownloadFailuresOnly: !state.filters.showDownloadFailuresOnly,
      },
    })),

  expandRow: (acquisitionId) =>
    set((state) => {
      if (state.expandedRowIds.includes(acquisitionId)) {
        return state
      }
      return {
        expandedRowIds: [...state.expandedRowIds, acquisitionId],
      }
    }),

  collapseRow: (acquisitionId) =>
    set((state) => ({
      expandedRowIds: state.expandedRowIds.filter(
        (existing) => existing !== acquisitionId,
      ),
    })),

  resetFilters: () => set({ filters: defaultFilters }),
}))


