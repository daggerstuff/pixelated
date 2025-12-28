import { create } from 'zustand'

export type SessionPhase =
  | 'discovery'
  | 'evaluation'
  | 'acquisition'
  | 'integration'
  | 'reporting'
  | 'unknown'

interface SessionFilters {
  searchTerm: string
  phases: SessionPhase[]
}

interface SessionStoreState {
  selectedSessionId: string | null
  filters: SessionFilters
  isCreateDrawerOpen: boolean

  setSelectedSessionId: (sessionId: string | null) => void
  togglePhaseFilter: (phase: SessionPhase) => void
  setSearchTerm: (searchTerm: string) => void
  resetFilters: () => void
  openCreateDrawer: () => void
  closeCreateDrawer: () => void
}

const defaultFilters: SessionFilters = {
  searchTerm: '',
  phases: [],
}

export const useJournalSessionStore = create<SessionStoreState>((set) => ({
  selectedSessionId: null,
  filters: defaultFilters,
  isCreateDrawerOpen: false,

  setSelectedSessionId: (sessionId) => set({ selectedSessionId: sessionId }),

  togglePhaseFilter: (phase) =>
    set((state) => {
      const phases = state.filters.phases.includes(phase)
        ? state.filters.phases.filter((existing) => existing !== phase)
        : [...state.filters.phases, phase]
      return {
        filters: {
          ...state.filters,
          phases,
        },
      }
    }),

  setSearchTerm: (searchTerm) =>
    set((state) => ({
      filters: {
        ...state.filters,
        searchTerm,
      },
    })),

  resetFilters: () => set({ filters: defaultFilters }),

  openCreateDrawer: () => set({ isCreateDrawerOpen: true }),
  closeCreateDrawer: () => set({ isCreateDrawerOpen: false }),
}))


