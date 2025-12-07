import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getProgress,
  getProgressMetrics,
  generateReport,
  type Report,
  type ReportGeneratePayload,
} from '@/lib/api/journal-research'
import {
  journalResearchMutationKeys,
  journalResearchQueryKeys,
} from '@/lib/api/journal-research/react-query'

export const useProgressQuery = (
  sessionId: string | null,
  options: { enabled?: boolean } = {},
) => {
  const { enabled = true } = options
  return useQuery({
    queryKey: journalResearchQueryKeys.progress.detail(sessionId ?? 'unknown'),
    queryFn: () => getProgress(sessionId ?? ''),
    enabled: Boolean(sessionId) && enabled,
  })
}

export const useProgressMetricsQuery = (
  sessionId: string | null,
  options: { enabled?: boolean; refetchInterval?: number } = {},
) => {
  const { enabled = true, refetchInterval } = options
  return useQuery({
    queryKey: journalResearchQueryKeys.progress.metrics(
      sessionId ?? 'unknown',
    ),
    queryFn: () => getProgressMetrics(sessionId ?? ''),
    enabled: Boolean(sessionId) && enabled,
    refetchInterval,
  })
}

export const useInvalidateProgress = () => {
  const queryClient = useQueryClient()
  return (sessionId: string) => {
    queryClient.invalidateQueries({
      queryKey: journalResearchQueryKeys.progress.detail(sessionId),
    })
    queryClient.invalidateQueries({
      queryKey: journalResearchQueryKeys.progress.metrics(sessionId),
    })
  }
}

export const useGenerateReportMutation = (sessionId: string | null) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: journalResearchMutationKeys.reports.generate(),
    mutationFn: (payload: ReportGeneratePayload) =>
      generateReport(sessionId ?? '', payload),
    onSuccess: (report: Report) => {
      queryClient.invalidateQueries({
        queryKey: journalResearchQueryKeys.reports.list(
          report.sessionId,
          {},
        ),
        exact: false,
      })
    },
  })
}


