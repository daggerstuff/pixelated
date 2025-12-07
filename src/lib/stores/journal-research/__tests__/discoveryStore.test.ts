import { describe, it, expect, beforeEach } from 'vitest'
import { useDiscoveryStore, } from '../discoveryStore'

describe('discoveryStore', () => {
  beforeEach(() => {
    useDiscoveryStore.setState({
      selectedSourceId: null,
      filters: {
        openAccessOnly: false,
        sourceTypes: [],
        keywords: [],
        sortBy: 'relevance',
        sortDirection: 'desc',
      },
      highlightSourceId: null,
    })
  })

  describe('initial state', () => {
    it('has null selectedSourceId initially', () => {
      const state = useDiscoveryStore.getState()
      expect(state.selectedSourceId).toBeNull()
    })

    it('has default filters initially', () => {
      const state = useDiscoveryStore.getState()
      expect(state.filters.openAccessOnly).toBe(false)
      expect(state.filters.sourceTypes).toEqual([])
      expect(state.filters.keywords).toEqual([])
      expect(state.filters.sortBy).toBe('relevance')
      expect(state.filters.sortDirection).toBe('desc')
    })

    it('has null highlightSourceId initially', () => {
      const state = useDiscoveryStore.getState()
      expect(state.highlightSourceId).toBeNull()
    })
  })

  describe('setSelectedSourceId', () => {
    it('sets selected source ID', () => {
      useDiscoveryStore.getState().setSelectedSourceId('source-1')

      const state = useDiscoveryStore.getState()
      expect(state.selectedSourceId).toBe('source-1')
    })

    it('can set selected source ID to null', () => {
      useDiscoveryStore.getState().setSelectedSourceId('source-1')
      useDiscoveryStore.getState().setSelectedSourceId(null)

      const state = useDiscoveryStore.getState()
      expect(state.selectedSourceId).toBeNull()
    })
  })

  describe('setHighlightSourceId', () => {
    it('sets highlight source ID', () => {
      useDiscoveryStore.getState().setHighlightSourceId('source-1')

      const state = useDiscoveryStore.getState()
      expect(state.highlightSourceId).toBe('source-1')
    })

    it('can set highlight source ID to null', () => {
      useDiscoveryStore.getState().setHighlightSourceId('source-1')
      useDiscoveryStore.getState().setHighlightSourceId(null)

      const state = useDiscoveryStore.getState()
      expect(state.highlightSourceId).toBeNull()
    })
  })

  describe('toggleSourceType', () => {
    it('adds source type to filters when not present', () => {
      useDiscoveryStore.getState().toggleSourceType('journal_article')

      const state = useDiscoveryStore.getState()
      expect(state.filters.sourceTypes).toContain('journal_article')
    })

    it('removes source type from filters when present', () => {
      useDiscoveryStore.getState().toggleSourceType('journal_article')
      useDiscoveryStore.getState().toggleSourceType('journal_article')

      const state = useDiscoveryStore.getState()
      expect(state.filters.sourceTypes).not.toContain('journal_article')
    })

    it('can toggle multiple source types', () => {
      useDiscoveryStore.getState().toggleSourceType('journal_article')
      useDiscoveryStore.getState().toggleSourceType('preprint')

      const state = useDiscoveryStore.getState()
      expect(state.filters.sourceTypes).toContain('journal_article')
      expect(state.filters.sourceTypes).toContain('preprint')
    })
  })

  describe('toggleKeyword', () => {
    it('adds keyword to filters when not present', () => {
      useDiscoveryStore.getState().toggleKeyword('depression')

      const state = useDiscoveryStore.getState()
      expect(state.filters.keywords).toContain('depression')
    })

    it('removes keyword from filters when present', () => {
      useDiscoveryStore.getState().toggleKeyword('depression')
      useDiscoveryStore.getState().toggleKeyword('depression')

      const state = useDiscoveryStore.getState()
      expect(state.filters.keywords).not.toContain('depression')
    })
  })

  describe('toggleOpenAccess', () => {
    it('toggles open access filter', () => {
      const initialState = useDiscoveryStore.getState()
      expect(initialState.filters.openAccessOnly).toBe(false)

      useDiscoveryStore.getState().toggleOpenAccess()

      const state = useDiscoveryStore.getState()
      expect(state.filters.openAccessOnly).toBe(true)

      useDiscoveryStore.getState().toggleOpenAccess()

      const finalState = useDiscoveryStore.getState()
      expect(finalState.filters.openAccessOnly).toBe(false)
    })
  })

  describe('setSort', () => {
    it('sets sort field and direction', () => {
      useDiscoveryStore.getState().setSort('publication_date', 'asc')

      const state = useDiscoveryStore.getState()
      expect(state.filters.sortBy).toBe('publication_date')
      expect(state.filters.sortDirection).toBe('asc')
    })

    it('keeps current direction when not provided', () => {
      useDiscoveryStore.getState().setSort('publication_date', 'asc')
      useDiscoveryStore.getState().setSort('title')

      const state = useDiscoveryStore.getState()
      expect(state.filters.sortBy).toBe('title')
      expect(state.filters.sortDirection).toBe('asc')
    })
  })

  describe('resetFilters', () => {
    it('resets filters to default state', () => {
      useDiscoveryStore.getState().toggleSourceType('journal_article')
      useDiscoveryStore.getState().toggleKeyword('depression')
      useDiscoveryStore.getState().toggleOpenAccess()
      useDiscoveryStore.getState().setSort('publication_date', 'asc')

      useDiscoveryStore.getState().resetFilters()

      const state = useDiscoveryStore.getState()
      expect(state.filters.openAccessOnly).toBe(false)
      expect(state.filters.sourceTypes).toEqual([])
      expect(state.filters.keywords).toEqual([])
      expect(state.filters.sortBy).toBe('relevance')
      expect(state.filters.sortDirection).toBe('desc')
    })
  })
})

