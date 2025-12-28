import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getSource,
  initiateDiscovery,
  listSources,
  type DiscoveryInitiatePayload,
  type DiscoveryResponse,
  type SourceList,
} from '@/lib/api/journal-research'
import {
  journalResearchMutationKeys,
  journalResearchQueryKeys,
} from '@/lib/api/journal-research/react-query'
import { useDiscoveryStore } from '@/lib/stores/journal-research'

interface UseDiscoveryListOptions {
  page?: number
  pageSize?: number
  enabled?: boolean
}

const filterSources = (
  data: SourceList,
  filters: ReturnType<typeof useDiscoveryStore.getState>['filters'],
): SourceList => {
  const filteredItems = data.items.filter((source) => {
    if (filters.openAccessOnly && !source.openAccess) {
      return false
    }
    if (
      filters.sourceTypes.length &&
      !filters.sourceTypes.includes(source.sourceType)
    ) {
      return false
    }
    if (filters.keywords.length) {
      const loweredKeywords = filters.keywords.map((keyword) =>
        keyword.toLowerCase(),
      )
      const matchesKeyword =
        loweredKeywords.some((keyword) =>
          source.title.toLowerCase().includes(keyword),
        ) ||
        source.keywords.some((keyword) =>
          loweredKeywords.includes(keyword.toLowerCase()),
        )
      if (!matchesKeyword) {
        return false
      }
    }
    return true
  })

  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (filters.sortBy) {
      case 'publication_date': {
        const diff =
          new Date(a.publicationDate).getTime() -
          new Date(b.publicationDate).getTime()
        return filters.sortDirection === 'asc' ? diff : -diff
      }
      case 'title': {
        const diff = a.title.localeCompare(b.title)
        return filters.sortDirection === 'asc' ? diff : -diff
      }
      case 'data_availability': {
        const diff = a.dataAvailability.localeCompare(b.dataAvailability)
        return filters.sortDirection === 'asc' ? diff : -diff
      }
      case 'relevance':
      default: {
        return 0
      }
    }
  })

  const total = sortedItems.length
  const pageSize = data.pageSize
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return {
    ...data,
    items: sortedItems,
    total,
    page: Math.min(data.page, totalPages),
    totalPages,
  }
}

export const useDiscoveryListQuery = (
  sessionId: string | null,
  { page = 1, pageSize = 25, enabled = true }: UseDiscoveryListOptions = {},
) => {
  const filters = useDiscoveryStore((state) => state.filters)

  return useQuery({
    queryKey: journalResearchQueryKeys.discovery.list(sessionId ?? 'unknown', {
      page,
      pageSize,
      filters,
    }),
    queryFn: () => listSources(sessionId ?? '', { page, pageSize }),
    enabled: Boolean(sessionId) && enabled,
    select: (data) => filterSources(data, filters),
  })
}

export const useDiscoveryInitiateMutation = (sessionId: string | null) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: journalResearchMutationKeys.discovery.initiate(),
    mutationFn: (payload: DiscoveryInitiatePayload) =>
      initiateDiscovery(sessionId ?? '', payload),
    onSuccess: (result: DiscoveryResponse) => {
      queryClient.invalidateQueries({
        queryKey: journalResearchQueryKeys.discovery.list(result.sessionId, {}),
        exact: false,
      })
    },
  })
}

export const useSourceQuery = (
  sessionId: string | null,
  sourceId: string | null,
  options: { enabled?: boolean } = {},
) => {
  const { enabled = true } = options
  return useQuery({
    queryKey: journalResearchQueryKeys.discovery.detail(
      sessionId ?? 'unknown',
      sourceId ?? 'unknown',
    ),
    queryFn: () => getSource(sessionId ?? '', sourceId ?? ''),
    enabled: Boolean(sessionId && sourceId) && enabled,
  })
}

export const useDiscoverySelection = () =>
  useDiscoveryStore((state) => ({
    selectedSourceId: state.selectedSourceId,
    setSelectedSourceId: state.setSelectedSourceId,
    highlightSourceId: state.highlightSourceId,
    setHighlightSourceId: state.setHighlightSourceId,
  }))


