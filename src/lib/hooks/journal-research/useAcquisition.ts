import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getAcquisition,
  initiateAcquisition,
  listAcquisitions,
  updateAcquisition,
  type Acquisition,
  type AcquisitionInitiatePayload,
  type AcquisitionList,
  type AcquisitionUpdatePayload,
} from '@/lib/api/journal-research'
import {
  journalResearchMutationKeys,
  journalResearchQueryKeys,
} from '@/lib/api/journal-research/react-query'
import {
  type AcquisitionStatus,
  useAcquisitionStore,
} from '@/lib/stores/journal-research'

interface UseAcquisitionListOptions {
  page?: number
  pageSize?: number
  enabled?: boolean
}

const filterAcquisitions = (
  data: AcquisitionList,
  filters: ReturnType<typeof useAcquisitionStore.getState>['filters'],
): AcquisitionList => {
  const filteredItems = data.items.filter((acquisition) => {
    if (
      filters.statuses.length &&
      !filters.statuses.includes(acquisition.status as AcquisitionStatus)
    ) {
      return false
    }

    if (
      filters.showDownloadFailuresOnly &&
      acquisition.status !== 'failed'
    ) {
      return false
    }

    return true
  })

  const total = filteredItems.length
  const pageSize = data.pageSize
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return {
    ...data,
    items: filteredItems,
    total,
    page: Math.min(data.page, totalPages),
    totalPages,
  }
}

export const useAcquisitionListQuery = (
  sessionId: string | null,
  { page = 1, pageSize = 25, enabled = true }: UseAcquisitionListOptions = {},
) => {
  const filters = useAcquisitionStore((state) => state.filters)

  return useQuery({
    queryKey: journalResearchQueryKeys.acquisition.list(
      sessionId ?? 'unknown',
      { page, pageSize, filters },
    ),
    queryFn: () => listAcquisitions(sessionId ?? '', { page, pageSize }),
    enabled: Boolean(sessionId) && enabled,
    select: (data) => filterAcquisitions(data, filters),
  })
}

export const useAcquisitionQuery = (
  sessionId: string | null,
  acquisitionId: string | null,
  options: { enabled?: boolean } = {},
) => {
  const { enabled = true } = options
  return useQuery({
    queryKey: journalResearchQueryKeys.acquisition.detail(
      sessionId ?? 'unknown',
      acquisitionId ?? 'unknown',
    ),
    queryFn: () => getAcquisition(sessionId ?? '', acquisitionId ?? ''),
    enabled: Boolean(sessionId && acquisitionId) && enabled,
  })
}

export const useAcquisitionInitiateMutation = (sessionId: string | null) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: journalResearchMutationKeys.acquisition.initiate(),
    mutationFn: (payload: AcquisitionInitiatePayload) =>
      initiateAcquisition(sessionId ?? '', payload),
    onSuccess: (acquisition: Acquisition) => {
      queryClient.invalidateQueries({
        queryKey: journalResearchQueryKeys.acquisition.list(
          sessionId ?? 'unknown',
          {},
        ),
        exact: false,
      })
      useAcquisitionStore.getState().setSelectedAcquisitionId(
        acquisition.acquisitionId,
      )
    },
  })
}

export const useAcquisitionUpdateMutation = (sessionId: string | null) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: journalResearchMutationKeys.acquisition.update(),
    mutationFn: ({
      acquisitionId,
      payload,
    }: {
      acquisitionId: string
      payload: AcquisitionUpdatePayload
    }) => updateAcquisition(sessionId ?? '', acquisitionId, payload),
    onSuccess: (acquisition: Acquisition) => {
      queryClient.invalidateQueries({
        queryKey: journalResearchQueryKeys.acquisition.detail(
          sessionId ?? 'unknown',
          acquisition.acquisitionId,
        ),
      })
      queryClient.invalidateQueries({
        queryKey: journalResearchQueryKeys.acquisition.list(
          sessionId ?? 'unknown',
          {},
        ),
        exact: false,
      })
    },
  })
}

export const useAcquisitionSelection = () =>
  useAcquisitionStore((state) => ({
    selectedAcquisitionId: state.selectedAcquisitionId,
    setSelectedAcquisitionId: state.setSelectedAcquisitionId,
    expandedRowIds: state.expandedRowIds,
    expandRow: state.expandRow,
    collapseRow: state.collapseRow,
  }))


