import { describe, it, expect, beforeEach } from 'vitest'
import { useIntegrationStore } from '../integrationStore'

describe('integrationStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useIntegrationStore.setState({
      selectedPlanId: null,
      filters: {
        targetFormats: [],
        complexityLevels: [],
        maxEffortHours: null,
      },
      comparePlanIds: [],
    })
  })

  describe('selectedPlanId', () => {
    it('should initialize with null', () => {
      const state = useIntegrationStore.getState()
      expect(state.selectedPlanId).toBeNull()
    })

    it('should set selected plan ID', () => {
      useIntegrationStore.getState().setSelectedPlanId('plan-1')
      expect(useIntegrationStore.getState().selectedPlanId).toBe('plan-1')
    })

    it('should clear selected plan ID', () => {
      useIntegrationStore.getState().setSelectedPlanId('plan-1')
      useIntegrationStore.getState().setSelectedPlanId(null)
      expect(useIntegrationStore.getState().selectedPlanId).toBeNull()
    })
  })

  describe('filters', () => {
    it('should initialize with default filters', () => {
      const state = useIntegrationStore.getState()
      expect(state.filters.targetFormats).toEqual([])
      expect(state.filters.complexityLevels).toEqual([])
      expect(state.filters.maxEffortHours).toBeNull()
    })

    it('should toggle target format filter', () => {
      useIntegrationStore.getState().toggleTargetFormat('jsonl')
      
      expect(useIntegrationStore.getState().filters.targetFormats).toContain('jsonl')
    })

    it('should remove target format filter when toggled again', () => {
      useIntegrationStore.getState().toggleTargetFormat('jsonl')
      useIntegrationStore.getState().toggleTargetFormat('jsonl')
      
      expect(useIntegrationStore.getState().filters.targetFormats).not.toContain('jsonl')
    })

    it('should toggle multiple target format filters', () => {
      useIntegrationStore.getState().toggleTargetFormat('jsonl')
      useIntegrationStore.getState().toggleTargetFormat('csv')
      
      const formats = useIntegrationStore.getState().filters.targetFormats
      expect(formats).toContain('jsonl')
      expect(formats).toContain('csv')
    })

    it('should toggle complexity level filter', () => {
      useIntegrationStore.getState().toggleComplexityLevel('low')
      
      expect(useIntegrationStore.getState().filters.complexityLevels).toContain('low')
    })

    it('should remove complexity level filter when toggled again', () => {
      useIntegrationStore.getState().toggleComplexityLevel('low')
      useIntegrationStore.getState().toggleComplexityLevel('low')
      
      expect(useIntegrationStore.getState().filters.complexityLevels).not.toContain('low')
    })

    it('should toggle multiple complexity level filters', () => {
      useIntegrationStore.getState().toggleComplexityLevel('low')
      useIntegrationStore.getState().toggleComplexityLevel('medium')
      
      const levels = useIntegrationStore.getState().filters.complexityLevels
      expect(levels).toContain('low')
      expect(levels).toContain('medium')
    })

    it('should set max effort hours', () => {
      useIntegrationStore.getState().setMaxEffortHours(10)
      expect(useIntegrationStore.getState().filters.maxEffortHours).toBe(10)
    })

    it('should clear max effort hours', () => {
      useIntegrationStore.getState().setMaxEffortHours(10)
      useIntegrationStore.getState().setMaxEffortHours(null)
      expect(useIntegrationStore.getState().filters.maxEffortHours).toBeNull()
    })

    it('should reset filters to default', () => {
      useIntegrationStore.getState().toggleTargetFormat('jsonl')
      useIntegrationStore.getState().toggleComplexityLevel('low')
      useIntegrationStore.getState().setMaxEffortHours(10)
      
      useIntegrationStore.getState().resetFilters()
      
      const filters = useIntegrationStore.getState().filters
      expect(filters.targetFormats).toEqual([])
      expect(filters.complexityLevels).toEqual([])
      expect(filters.maxEffortHours).toBeNull()
    })
  })

  describe('comparePlanIds', () => {
    it('should initialize with empty array', () => {
      const state = useIntegrationStore.getState()
      expect(state.comparePlanIds).toEqual([])
    })

    it('should toggle compare plan ID', () => {
      useIntegrationStore.getState().toggleComparePlanId('plan-1')
      expect(useIntegrationStore.getState().comparePlanIds).toContain('plan-1')
    })

    it('should remove compare plan ID when toggled again', () => {
      useIntegrationStore.getState().toggleComparePlanId('plan-1')
      useIntegrationStore.getState().toggleComparePlanId('plan-1')
      
      expect(useIntegrationStore.getState().comparePlanIds).not.toContain('plan-1')
    })

    it('should toggle multiple compare plan IDs', () => {
      useIntegrationStore.getState().toggleComparePlanId('plan-1')
      useIntegrationStore.getState().toggleComparePlanId('plan-2')
      
      const compareIds = useIntegrationStore.getState().comparePlanIds
      expect(compareIds).toContain('plan-1')
      expect(compareIds).toContain('plan-2')
    })

    it('should clear all compare plan IDs', () => {
      useIntegrationStore.getState().toggleComparePlanId('plan-1')
      useIntegrationStore.getState().toggleComparePlanId('plan-2')
      
      useIntegrationStore.getState().clearCompare()
      
      expect(useIntegrationStore.getState().comparePlanIds).toEqual([])
    })
  })
})

