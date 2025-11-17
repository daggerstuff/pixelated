import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getEvaluation,
  initiateEvaluation,
  listEvaluations,
  updateEvaluation,
  type Evaluation,
  type EvaluationInitiatePayload,
  type EvaluationList,
  type EvaluationUpdatePayload,
} from '@/lib/api/journal-research'
import {
  journalResearchMutationKeys,
  journalResearchQueryKeys,
} from '@/lib/api/journal-research/react-query'
import { useEvaluationStore } from '@/lib/stores/journal-research'

interface UseEvaluationListOptions {
  page?: number
  pageSize?: number
  enabled?: boolean
}

const filterEvaluations = (
  data: EvaluationList,
  filters: ReturnType<typeof useEvaluationStore.getState>['filters'],
): EvaluationList => {
  const filteredItems = data.items.filter((evaluation) => {
    if (
      filters.priorityTiers.length &&
      !filters.priorityTiers.includes(evaluation.priorityTier)
    ) {
      return false
    }

    if (
      filters.minimumScore !== null &&
      evaluation.overallScore < filters.minimumScore
    ) {
      return false
    }

    if (
      filters.maximumScore !== null &&
      evaluation.overallScore > filters.maximumScore
    ) {
      return false
    }

    return true
  })

  const sortedItems = [...filteredItems].sort((a, b) => {
    const direction = filters.sortDirection === 'asc' ? 1 : -1
    switch (filters.sortBy) {
      case 'therapeutic_relevance':
        return (a.therapeuticRelevance - b.therapeuticRelevance) * direction
      case 'data_structure_quality':
        return (a.dataStructureQuality - b.dataStructureQuality) * direction
      case 'training_integration':
        return (a.trainingIntegration - b.trainingIntegration) * direction
      case 'ethical_accessibility':
        return (a.ethicalAccessibility - b.ethicalAccessibility) * direction
      case 'evaluation_date':
        return (
          (new Date(a.evaluationDate).getTime() -
            new Date(b.evaluationDate).getTime()) * direction
        )
      case 'overall_score':
      default:
        return (a.overallScore - b.overallScore) * direction
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

export const useEvaluationListQuery = (
  sessionId: string | null,
  { page = 1, pageSize = 25, enabled = true }: UseEvaluationListOptions = {},
) => {
  const filters = useEvaluationStore((state) => state.filters)

  return useQuery({
    queryKey: journalResearchQueryKeys.evaluation.list(sessionId ?? 'unknown', {
      page,
      pageSize,
      filters,
    }),
    queryFn: () => listEvaluations(sessionId ?? '', { page, pageSize }),
    enabled: Boolean(sessionId) && enabled,
    select: (data) => filterEvaluations(data, filters),
  })
}

export const useEvaluationQuery = (
  sessionId: string | null,
  evaluationId: string | null,
  options: { enabled?: boolean } = {},
) => {
  const { enabled = true } = options
  return useQuery({
    queryKey: journalResearchQueryKeys.evaluation.detail(
      sessionId ?? 'unknown',
      evaluationId ?? 'unknown',
    ),
    queryFn: () => getEvaluation(sessionId ?? '', evaluationId ?? ''),
    enabled: Boolean(sessionId && evaluationId) && enabled,
  })
}

export const useEvaluationInitiateMutation = (sessionId: string | null) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: journalResearchMutationKeys.evaluation.initiate(),
    mutationFn: (payload: EvaluationInitiatePayload) =>
      initiateEvaluation(sessionId ?? '', payload),
    onSuccess: (evaluation: Evaluation) => {
      queryClient.invalidateQueries({
        queryKey: journalResearchQueryKeys.evaluation.list(
          sessionId ?? 'unknown',
          {},
        ),
        exact: false,
      })
      useEvaluationStore.getState().setSelectedEvaluationId(
        evaluation.evaluationId,
      )
    },
  })
}

export const useEvaluationUpdateMutation = (sessionId: string | null) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: journalResearchMutationKeys.evaluation.update(),
    mutationFn: ({
      evaluationId,
      payload,
    }: {
      evaluationId: string
      payload: EvaluationUpdatePayload
    }) => updateEvaluation(sessionId ?? '', evaluationId, payload),
    onSuccess: (evaluation: Evaluation) => {
      queryClient.invalidateQueries({
        queryKey: journalResearchQueryKeys.evaluation.detail(
          sessionId ?? 'unknown',
          evaluation.evaluationId,
        ),
      })
      queryClient.invalidateQueries({
        queryKey: journalResearchQueryKeys.evaluation.list(
          sessionId ?? 'unknown',
          {},
        ),
        exact: false,
      })
    },
  })
}

export const useEvaluationSelection = () =>
  useEvaluationStore((state) => ({
    selectedEvaluationId: state.selectedEvaluationId,
    setSelectedEvaluationId: state.setSelectedEvaluationId,
    editingEvaluationId: state.editingEvaluationId,
    setEditingEvaluationId: state.setEditingEvaluationId,
    isBulkEditMode: state.isBulkEditMode,
    toggleBulkEditMode: state.toggleBulkEditMode,
  }))


