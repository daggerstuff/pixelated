import { journalResearchApiClient } from './client'
import {
  Progress,
  ProgressMetrics,
  ProgressMetricsResponseSchema,
  ProgressSchema,
} from './types'

export async function getProgress(sessionId: string): Promise<Progress> {
  return journalResearchApiClient.request<Progress>(
    `/sessions/${sessionId}/progress`,
    {
      validator: ProgressSchema,
    },
  )
}

export async function getProgressMetrics(
  sessionId: string,
): Promise<ProgressMetrics> {
  return journalResearchApiClient.request<ProgressMetrics>(
    `/sessions/${sessionId}/progress/metrics`,
    {
      validator: ProgressMetricsResponseSchema,
    },
  )
}


