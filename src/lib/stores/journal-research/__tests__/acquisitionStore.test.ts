import { describe, it, expect, beforeEach } from 'vitest'
import { useAcquisitionStore } from '../acquisitionStore'
import type { AcquisitionStatus } from '../acquisitionStore'

describe('acquisitionStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAcquisitionStore.setState({
      selectedAcquisitionId: null,
      filters: {
        statuses: [],
        showDownloadFailuresOnly: false,
      },
      expandedRowIds: [],
    })
  })

  describe('selectedAcquisitionId', () => {
    it('should initialize with null', () => {
      const state = useAcquisitionStore.getState()
      expect(state.selectedAcquisitionId).toBeNull()
    })

    it('should set selected acquisition ID', () => {
      useAcquisitionStore.getState().setSelectedAcquisitionId('acq-1')
      expect(useAcquisitionStore.getState().selectedAcquisitionId).toBe('acq-1')
    })

    it('should clear selected acquisition ID', () => {
      useAcquisitionStore.getState().setSelectedAcquisitionId('acq-1')
      useAcquisitionStore.getState().setSelectedAcquisitionId(null)
      expect(useAcquisitionStore.getState().selectedAcquisitionId).toBeNull()
    })
  })

  describe('filters', () => {
    it('should initialize with default filters', () => {
      const state = useAcquisitionStore.getState()
      expect(state.filters.statuses).toEqual([])
      expect(state.filters.showDownloadFailuresOnly).toBe(false)
    })

    it('should toggle status filter', () => {
      const status: AcquisitionStatus = 'pending'
      useAcquisitionStore.getState().toggleStatusFilter(status)
      
      expect(useAcquisitionStore.getState().filters.statuses).toContain(status)
    })

    it('should remove status filter when toggled again', () => {
      const status: AcquisitionStatus = 'pending'
      useAcquisitionStore.getState().toggleStatusFilter(status)
      useAcquisitionStore.getState().toggleStatusFilter(status)
      
      expect(useAcquisitionStore.getState().filters.statuses).not.toContain(status)
    })

    it('should toggle multiple status filters', () => {
      useAcquisitionStore.getState().toggleStatusFilter('pending')
      useAcquisitionStore.getState().toggleStatusFilter('completed')
      
      const statuses = useAcquisitionStore.getState().filters.statuses
      expect(statuses).toContain('pending')
      expect(statuses).toContain('completed')
    })

    it('should toggle showDownloadFailuresOnly', () => {
      useAcquisitionStore.getState().toggleShowDownloadFailuresOnly()
      expect(useAcquisitionStore.getState().filters.showDownloadFailuresOnly).toBe(true)
    })

    it('should reset filters to default', () => {
      useAcquisitionStore.getState().toggleStatusFilter('pending')
      useAcquisitionStore.getState().toggleShowDownloadFailuresOnly()
      
      useAcquisitionStore.getState().resetFilters()
      
      const filters = useAcquisitionStore.getState().filters
      expect(filters.statuses).toEqual([])
      expect(filters.showDownloadFailuresOnly).toBe(false)
    })
  })

  describe('expandedRowIds', () => {
    it('should initialize with empty array', () => {
      const state = useAcquisitionStore.getState()
      expect(state.expandedRowIds).toEqual([])
    })

    it('should expand a row', () => {
      useAcquisitionStore.getState().expandRow('acq-1')
      expect(useAcquisitionStore.getState().expandedRowIds).toContain('acq-1')
    })

    it('should not duplicate expanded rows', () => {
      useAcquisitionStore.getState().expandRow('acq-1')
      useAcquisitionStore.getState().expandRow('acq-1')
      
      const expanded = useAcquisitionStore.getState().expandedRowIds
      expect(expanded.filter((id) => id === 'acq-1')).toHaveLength(1)
    })

    it('should expand multiple rows', () => {
      useAcquisitionStore.getState().expandRow('acq-1')
      useAcquisitionStore.getState().expandRow('acq-2')
      
      const expanded = useAcquisitionStore.getState().expandedRowIds
      expect(expanded).toContain('acq-1')
      expect(expanded).toContain('acq-2')
    })

    it('should collapse a row', () => {
      useAcquisitionStore.getState().expandRow('acq-1')
      useAcquisitionStore.getState().collapseRow('acq-1')
      
      expect(useAcquisitionStore.getState().expandedRowIds).not.toContain('acq-1')
    })

    it('should collapse only specified row', () => {
      useAcquisitionStore.getState().expandRow('acq-1')
      useAcquisitionStore.getState().expandRow('acq-2')
      useAcquisitionStore.getState().collapseRow('acq-1')
      
      const expanded = useAcquisitionStore.getState().expandedRowIds
      expect(expanded).not.toContain('acq-1')
      expect(expanded).toContain('acq-2')
    })
  })
})

