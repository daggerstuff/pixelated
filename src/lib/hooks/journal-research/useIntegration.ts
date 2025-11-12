import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getIntegrationPlan,
  initiateIntegration,
  listIntegrationPlans,
  type IntegrationInitiatePayload,
  type IntegrationPlan,
  type IntegrationPlanList,
} from '@/lib/api/journal-research'
import {
  journalResearchMutationKeys,
  journalResearchQueryKeys,
} from '@/lib/api/journal-research/react-query'
import { useIntegrationStore } from '@/lib/stores/journal-research'

interface UseIntegrationListOptions {
  page?: number
  pageSize?: number
  enabled?: boolean
}

const filterPlans = (
  data: IntegrationPlanList,
  filters: ReturnType<typeof useIntegrationStore.getState>['filters'],
): IntegrationPlanList => {
  const filteredItems = data.items.filter((plan) => {
    if (
      filters.targetFormats.length &&
      !filters.targetFormats.includes(plan.targetFormat)
    ) {
      return false
    }

    if (
      filters.complexityLevels.length &&
      !filters.complexityLevels.includes(plan.complexity)
    ) {
      return false
    }

    if (
      filters.maxEffortHours !== null &&
      plan.estimatedEffortHours > filters.maxEffortHours
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

export const useIntegrationPlanListQuery = (
  sessionId: string | null,
  { page = 1, pageSize = 25, enabled = true }: UseIntegrationListOptions = {},
) => {
  const filters = useIntegrationStore((state) => state.filters)

  return useQuery({
    queryKey: journalResearchQueryKeys.integration.list(
      sessionId ?? 'unknown',
      { page, pageSize, filters },
    ),
    queryFn: () => listIntegrationPlans(sessionId ?? '', { page, pageSize }),
    enabled: Boolean(sessionId) && enabled,
    select: (data) => filterPlans(data, filters),
  })
}

export const useIntegrationPlanQuery = (
  sessionId: string | null,
  planId: string | null,
  options: { enabled?: boolean } = {},
) => {
  const { enabled = true } = options

  return useQuery({
    queryKey: journalResearchQueryKeys.integration.detail(
      sessionId ?? 'unknown',
      planId ?? 'unknown',
    ),
    queryFn: () => getIntegrationPlan(sessionId ?? '', planId ?? ''),
    enabled: Boolean(sessionId && planId) && enabled,
  })
}

export const useIntegrationInitiateMutation = (sessionId: string | null) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: journalResearchMutationKeys.integration.initiate(),
    mutationFn: (payload: IntegrationInitiatePayload) =>
      initiateIntegration(sessionId ?? '', payload),
    onSuccess: (plan: IntegrationPlan) => {
      queryClient.invalidateQueries({
        queryKey: journalResearchQueryKeys.integration.list(
          sessionId ?? 'unknown',
          {},
        ),
        exact: false,
      })
      useIntegrationStore.getState().setSelectedPlanId(plan.planId)
    },
  })
}

export const useIntegrationSelection = () =>
  useIntegrationStore((state) => ({
    selectedPlanId: state.selectedPlanId,
    setSelectedPlanId: state.setSelectedPlanId,
    comparePlanIds: state.comparePlanIds,
    toggleComparePlanId: state.toggleComparePlanId,
    clearCompare: state.clearCompare,
  }))


