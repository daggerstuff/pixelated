import { journalResearchApiClient } from './client'
import {
  Evaluation,
  EvaluationInitiatePayload,
  EvaluationList,
  EvaluationListSchema,
  EvaluationSchema,
  EvaluationUpdatePayload,
  serializeEvaluationInitiatePayload,
  serializeEvaluationUpdatePayload,
} from './types'

export interface ListEvaluationsParams {
  page?: number
  pageSize?: number
}

export async function initiateEvaluation(
  sessionId: string,
  payload: EvaluationInitiatePayload,
): Promise<Evaluation> {
  return journalResearchApiClient.request<Evaluation>(
    `/sessions/${sessionId}/evaluation`,
    {
      method: 'POST',
      body: serializeEvaluationInitiatePayload(payload),
      validator: EvaluationSchema,
    },
  )
}

export async function listEvaluations(
  sessionId: string,
  params: ListEvaluationsParams = {},
): Promise<EvaluationList> {
  const { page, pageSize } = params
  return journalResearchApiClient.request<EvaluationList>(
    `/sessions/${sessionId}/evaluation`,
    {
      params: {
        page,
        page_size: pageSize,
      },
      validator: EvaluationListSchema,
    },
  )
}

export async function getEvaluation(
  sessionId: string,
  evaluationId: string,
): Promise<Evaluation> {
  return journalResearchApiClient.request<Evaluation>(
    `/sessions/${sessionId}/evaluation/${evaluationId}`,
    {
      validator: EvaluationSchema,
    },
  )
}

export async function updateEvaluation(
  sessionId: string,
  evaluationId: string,
  payload: EvaluationUpdatePayload,
): Promise<Evaluation> {
  return journalResearchApiClient.request<Evaluation>(
    `/sessions/${sessionId}/evaluation/${evaluationId}`,
    {
      method: 'PUT',
      body: serializeEvaluationUpdatePayload(payload),
      validator: EvaluationSchema,
    },
  )
}


