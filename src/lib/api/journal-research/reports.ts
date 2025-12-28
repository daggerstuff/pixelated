import { journalResearchApiClient } from './client'
import {
  Report,
  ReportGeneratePayload,
  ReportList,
  ReportListSchema,
  ReportSchema,
  serializeReportGeneratePayload,
} from './types'

export interface ListReportsParams {
  page?: number
  pageSize?: number
}

export async function generateReport(
  sessionId: string,
  payload: ReportGeneratePayload,
): Promise<Report> {
  return journalResearchApiClient.request<Report>(
    `/sessions/${sessionId}/reports`,
    {
      method: 'POST',
      body: serializeReportGeneratePayload(payload),
      validator: ReportSchema,
    },
  )
}

export async function listReports(
  sessionId: string,
  params: ListReportsParams = {},
): Promise<ReportList> {
  const { page, pageSize } = params
  return journalResearchApiClient.request<ReportList>(
    `/sessions/${sessionId}/reports`,
    {
      params: {
        page,
        page_size: pageSize,
      },
      validator: ReportListSchema,
    },
  )
}

export async function getReport(
  sessionId: string,
  reportId: string,
): Promise<Report> {
  return journalResearchApiClient.request<Report>(
    `/sessions/${sessionId}/reports/${reportId}`,
    {
      validator: ReportSchema,
    },
  )
}


