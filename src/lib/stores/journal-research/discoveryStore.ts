import { create } from 'zustand'

export type DiscoverySort =
  | 'publication_date'
  | 'title'
  | 'relevance'
  | 'data_availability'

interface DiscoveryFilters {
  openAccessOnly: boolean
  sourceTypes: string[]
  keywords: string[]
  sortBy: DiscoverySort
  sortDirection: 'asc' | 'desc'
}

interface DiscoveryStoreState {
  selectedSourceId: string | null
  filters: DiscoveryFilters
  highlightSourceId: string | null

  setSelectedSourceId: (sourceId: string | null) => void
  setHighlightSourceId: (sourceId: string | null) => void
  toggleSourceType: (sourceType: string) => void
  toggleKeyword: (keyword: string) => void
  toggleOpenAccess: () => void
  setSort: (sortBy: DiscoverySort, sortDirection?: 'asc' | 'desc') => void
  resetFilters: () => void
}

const defaultFilters: DiscoveryFilters = {
  openAccessOnly: false,
  sourceTypes: [],
  keywords: [],
  sortBy: 'relevance',
  sortDirection: 'desc',
}

export const useDiscoveryStore = create<DiscoveryStoreState>((set) => ({
  selectedSourceId: null,
  filters: defaultFilters,
  highlightSourceId: null,

  setSelectedSourceId: (sourceId) => set({ selectedSourceId: sourceId }),
  setHighlightSourceId: (sourceId) => set({ highlightSourceId: sourceId }),

  toggleSourceType: (sourceType) =>
    set((state) => {
      const sourceTypes = state.filters.sourceTypes.includes(sourceType)
        ? state.filters.sourceTypes.filter((existing) => existing !== sourceType)
        : [...state.filters.sourceTypes, sourceType]

      return {
        filters: {
          ...state.filters,
          sourceTypes,
        },
      }
    }),

  toggleKeyword: (keyword) =>
    set((state) => {
      const keywords = state.filters.keywords.includes(keyword)
        ? state.filters.keywords.filter((existing) => existing !== keyword)
        : [...state.filters.keywords, keyword]

      return {
        filters: {
          ...state.filters,
          keywords,
        },
      }
    }),

  toggleOpenAccess: () =>
    set((state) => ({
      filters: {
        ...state.filters,
        openAccessOnly: !state.filters.openAccessOnly,
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

  resetFilters: () => set({ filters: defaultFilters }),
}))


