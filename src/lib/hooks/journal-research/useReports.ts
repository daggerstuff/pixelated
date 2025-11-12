import { useQuery } from '@tanstack/react-query'
import {
  getReport,
  listReports,
  type ReportList,
} from '@/lib/api/journal-research'
import { journalResearchQueryKeys } from '@/lib/api/journal-research/react-query'

interface UseReportListOptions {
  page?: number
  pageSize?: number
  enabled?: boolean
}

export const useReportListQuery = (
  sessionId: string | null,
  { page = 1, pageSize = 25, enabled = true }: UseReportListOptions = {},
) =>
  useQuery({
    queryKey: journalResearchQueryKeys.reports.list(sessionId ?? 'unknown', {
      page,
      pageSize,
    }),
    queryFn: () => listReports(sessionId ?? '', { page, pageSize }),
    enabled: Boolean(sessionId) && enabled,
    select: (data: ReportList) => data,
  })

export const useReportQuery = (
  sessionId: string | null,
  reportId: string | null,
  options: { enabled?: boolean } = {},
) => {
  const { enabled = true } = options
  return useQuery({
    queryKey: journalResearchQueryKeys.reports.detail(
      sessionId ?? 'unknown',
      reportId ?? 'unknown',
    ),
    queryFn: () => getReport(sessionId ?? '', reportId ?? ''),
    enabled: Boolean(sessionId && reportId) && enabled,
  })
}


