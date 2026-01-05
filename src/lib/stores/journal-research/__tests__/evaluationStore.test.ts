import { describe, it, expect, beforeEach } from 'vitest'
import { useEvaluationStore, } from '../evaluationStore'

describe('evaluationStore', () => {
  beforeEach(() => {
    useEvaluationStore.setState({
      selectedEvaluationId: null,
      editingEvaluationId: null,
      filters: {
        priorityTiers: [],
        minimumScore: null,
        maximumScore: null,
        sortBy: 'overall_score',
        sortDirection: 'desc',
      },
      isBulkEditMode: false,
    })
  })

  describe('initial state', () => {
    it('has null selectedEvaluationId initially', () => {
      const state = useEvaluationStore.getState()
      expect(state.selectedEvaluationId).toBeNull()
    })

    it('has null editingEvaluationId initially', () => {
      const state = useEvaluationStore.getState()
      expect(state.editingEvaluationId).toBeNull()
    })

    it('has default filters initially', () => {
      const state = useEvaluationStore.getState()
      expect(state.filters.priorityTiers).toEqual([])
      expect(state.filters.minimumScore).toBeNull()
      expect(state.filters.maximumScore).toBeNull()
      expect(state.filters.sortBy).toBe('overall_score')
      expect(state.filters.sortDirection).toBe('desc')
    })

    it('has bulk edit mode disabled initially', () => {
      const state = useEvaluationStore.getState()
      expect(state.isBulkEditMode).toBe(false)
    })
  })

  describe('setSelectedEvaluationId', () => {
    it('sets selected evaluation ID', () => {
      useEvaluationStore.getState().setSelectedEvaluationId('eval-1')

      const state = useEvaluationStore.getState()
      expect(state.selectedEvaluationId).toBe('eval-1')
    })

    it('can set selected evaluation ID to null', () => {
      useEvaluationStore.getState().setSelectedEvaluationId('eval-1')
      useEvaluationStore.getState().setSelectedEvaluationId(null)

      const state = useEvaluationStore.getState()
      expect(state.selectedEvaluationId).toBeNull()
    })
  })

  describe('setEditingEvaluationId', () => {
    it('sets editing evaluation ID', () => {
      useEvaluationStore.getState().setEditingEvaluationId('eval-1')

      const state = useEvaluationStore.getState()
      expect(state.editingEvaluationId).toBe('eval-1')
    })

    it('can set editing evaluation ID to null', () => {
      useEvaluationStore.getState().setEditingEvaluationId('eval-1')
      useEvaluationStore.getState().setEditingEvaluationId(null)

      const state = useEvaluationStore.getState()
      expect(state.editingEvaluationId).toBeNull()
    })
  })

  describe('togglePriorityTier', () => {
    it('adds priority tier to filters when not present', () => {
      useEvaluationStore.getState().togglePriorityTier('high')

      const state = useEvaluationStore.getState()
      expect(state.filters.priorityTiers).toContain('high')
    })

    it('removes priority tier from filters when present', () => {
      useEvaluationStore.getState().togglePriorityTier('high')
      useEvaluationStore.getState().togglePriorityTier('high')

      const state = useEvaluationStore.getState()
      expect(state.filters.priorityTiers).not.toContain('high')
    })

    it('can toggle multiple priority tiers', () => {
      useEvaluationStore.getState().togglePriorityTier('high')
      useEvaluationStore.getState().togglePriorityTier('medium')

      const state = useEvaluationStore.getState()
      expect(state.filters.priorityTiers).toContain('high')
      expect(state.filters.priorityTiers).toContain('medium')
    })
  })

  describe('setScoreRange', () => {
    it('sets score range', () => {
      useEvaluationStore.getState().setScoreRange(50, 100)

      const state = useEvaluationStore.getState()
      expect(state.filters.minimumScore).toBe(50)
      expect(state.filters.maximumScore).toBe(100)
    })

    it('can set minimum score to null', () => {
      useEvaluationStore.getState().setScoreRange(50, 100)
      useEvaluationStore.getState().setScoreRange(null, 100)

      const state = useEvaluationStore.getState()
      expect(state.filters.minimumScore).toBeNull()
      expect(state.filters.maximumScore).toBe(100)
    })

    it('can set maximum score to null', () => {
      useEvaluationStore.getState().setScoreRange(50, 100)
      useEvaluationStore.getState().setScoreRange(50, null)

      const state = useEvaluationStore.getState()
      expect(state.filters.minimumScore).toBe(50)
      expect(state.filters.maximumScore).toBeNull()
    })
  })

  describe('setSort', () => {
    it('sets sort field and direction', () => {
      useEvaluationStore.getState().setSort('therapeutic_relevance', 'asc')

      const state = useEvaluationStore.getState()
      expect(state.filters.sortBy).toBe('therapeutic_relevance')
      expect(state.filters.sortDirection).toBe('asc')
    })

    it('keeps current direction when not provided', () => {
      useEvaluationStore.getState().setSort('therapeutic_relevance', 'asc')
      useEvaluationStore.getState().setSort('data_structure_quality')

      const state = useEvaluationStore.getState()
      expect(state.filters.sortBy).toBe('data_structure_quality')
      expect(state.filters.sortDirection).toBe('asc')
    })
  })

  describe('toggleBulkEditMode', () => {
    it('toggles bulk edit mode', () => {
      const initialState = useEvaluationStore.getState()
      expect(initialState.isBulkEditMode).toBe(false)

      useEvaluationStore.getState().toggleBulkEditMode()

      const state = useEvaluationStore.getState()
      expect(state.isBulkEditMode).toBe(true)

      useEvaluationStore.getState().toggleBulkEditMode()

      const finalState = useEvaluationStore.getState()
      expect(finalState.isBulkEditMode).toBe(false)
    })
  })

  describe('resetFilters', () => {
    it('resets filters to default state', () => {
      useEvaluationStore.getState().togglePriorityTier('high')
      useEvaluationStore.getState().setScoreRange(50, 100)
      useEvaluationStore.getState().setSort('therapeutic_relevance', 'asc')

      useEvaluationStore.getState().resetFilters()

      const state = useEvaluationStore.getState()
      expect(state.filters.priorityTiers).toEqual([])
      expect(state.filters.minimumScore).toBeNull()
      expect(state.filters.maximumScore).toBeNull()
      expect(state.filters.sortBy).toBe('overall_score')
      expect(state.filters.sortDirection).toBe('desc')
    })
  })
})

