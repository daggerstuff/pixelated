import { describe, it, expect, beforeEach } from 'vitest'
import { useJournalSessionStore, } from '../sessionStore'

describe('sessionStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useJournalSessionStore.setState({
      selectedSessionId: null,
      filters: {
        searchTerm: '',
        phases: [],
      },
      isCreateDrawerOpen: false,
    })
  })

  describe('initial state', () => {
    it('has null selectedSessionId initially', () => {
      const state = useJournalSessionStore.getState()
      expect(state.selectedSessionId).toBeNull()
    })

    it('has empty filters initially', () => {
      const state = useJournalSessionStore.getState()
      expect(state.filters.searchTerm).toBe('')
      expect(state.filters.phases).toEqual([])
    })

    it('has closed create drawer initially', () => {
      const state = useJournalSessionStore.getState()
      expect(state.isCreateDrawerOpen).toBe(false)
    })
  })

  describe('setSelectedSessionId', () => {
    it('sets selected session ID', () => {
      useJournalSessionStore.getState().setSelectedSessionId('session-1')

      const state = useJournalSessionStore.getState()
      expect(state.selectedSessionId).toBe('session-1')
    })

    it('can set selected session ID to null', () => {
      useJournalSessionStore.getState().setSelectedSessionId('session-1')
      useJournalSessionStore.getState().setSelectedSessionId(null)

      const state = useJournalSessionStore.getState()
      expect(state.selectedSessionId).toBeNull()
    })
  })

  describe('togglePhaseFilter', () => {
    it('adds phase to filters when not present', () => {
      useJournalSessionStore.getState().togglePhaseFilter('discovery')

      const state = useJournalSessionStore.getState()
      expect(state.filters.phases).toContain('discovery')
    })

    it('removes phase from filters when present', () => {
      useJournalSessionStore.getState().togglePhaseFilter('discovery')
      useJournalSessionStore.getState().togglePhaseFilter('discovery')

      const state = useJournalSessionStore.getState()
      expect(state.filters.phases).not.toContain('discovery')
    })

    it('can toggle multiple phases', () => {
      useJournalSessionStore.getState().togglePhaseFilter('discovery')
      useJournalSessionStore.getState().togglePhaseFilter('evaluation')

      const state = useJournalSessionStore.getState()
      expect(state.filters.phases).toContain('discovery')
      expect(state.filters.phases).toContain('evaluation')
    })
  })

  describe('setSearchTerm', () => {
    it('sets search term', () => {
      useJournalSessionStore.getState().setSearchTerm('test query')

      const state = useJournalSessionStore.getState()
      expect(state.filters.searchTerm).toBe('test query')
    })

    it('can set search term to empty string', () => {
      useJournalSessionStore.getState().setSearchTerm('test query')
      useJournalSessionStore.getState().setSearchTerm('')

      const state = useJournalSessionStore.getState()
      expect(state.filters.searchTerm).toBe('')
    })
  })

  describe('resetFilters', () => {
    it('resets filters to default state', () => {
      useJournalSessionStore.getState().setSearchTerm('test')
      useJournalSessionStore.getState().togglePhaseFilter('discovery')
      useJournalSessionStore.getState().togglePhaseFilter('evaluation')

      useJournalSessionStore.getState().resetFilters()

      const state = useJournalSessionStore.getState()
      expect(state.filters.searchTerm).toBe('')
      expect(state.filters.phases).toEqual([])
    })
  })

  describe('openCreateDrawer', () => {
    it('opens create drawer', () => {
      useJournalSessionStore.getState().openCreateDrawer()

      const state = useJournalSessionStore.getState()
      expect(state.isCreateDrawerOpen).toBe(true)
    })
  })

  describe('closeCreateDrawer', () => {
    it('closes create drawer', () => {
      useJournalSessionStore.getState().openCreateDrawer()
      useJournalSessionStore.getState().closeCreateDrawer()

      const state = useJournalSessionStore.getState()
      expect(state.isCreateDrawerOpen).toBe(false)
    })
  })

  describe('combined operations', () => {
    it('maintains separate state for filters and drawer', () => {
      useJournalSessionStore.getState().setSearchTerm('test')
      useJournalSessionStore.getState().togglePhaseFilter('discovery')
      useJournalSessionStore.getState().openCreateDrawer()

      const state = useJournalSessionStore.getState()
      expect(state.filters.searchTerm).toBe('test')
      expect(state.filters.phases).toContain('discovery')
      expect(state.isCreateDrawerOpen).toBe(true)
    })

    it('can set session ID and filters independently', () => {
      useJournalSessionStore.getState().setSelectedSessionId('session-1')
      useJournalSessionStore.getState().setSearchTerm('test')
      useJournalSessionStore.getState().togglePhaseFilter('evaluation')

      const state = useJournalSessionStore.getState()
      expect(state.selectedSessionId).toBe('session-1')
      expect(state.filters.searchTerm).toBe('test')
      expect(state.filters.phases).toContain('evaluation')
    })
  })
})

