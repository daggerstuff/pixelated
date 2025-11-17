import { journalResearchApiClient } from './client'
import {
  IntegrationInitiatePayload,
  IntegrationPlan,
  IntegrationPlanList,
  IntegrationPlanListSchema,
  IntegrationPlanSchema,
  serializeIntegrationInitiatePayload,
} from './types'

export interface ListIntegrationPlansParams {
  page?: number
  pageSize?: number
}

export async function initiateIntegration(
  sessionId: string,
  payload: IntegrationInitiatePayload,
): Promise<IntegrationPlan> {
  return journalResearchApiClient.request<IntegrationPlan>(
    `/sessions/${sessionId}/integration`,
    {
      method: 'POST',
      body: serializeIntegrationInitiatePayload(payload),
      validator: IntegrationPlanSchema,
    },
  )
}

export async function listIntegrationPlans(
  sessionId: string,
  params: ListIntegrationPlansParams = {},
): Promise<IntegrationPlanList> {
  const { page, pageSize } = params
  return journalResearchApiClient.request<IntegrationPlanList>(
    `/sessions/${sessionId}/integration`,
    {
      params: {
        page,
        page_size: pageSize,
      },
      validator: IntegrationPlanListSchema,
    },
  )
}

export async function getIntegrationPlan(
  sessionId: string,
  planId: string,
): Promise<IntegrationPlan> {
  return journalResearchApiClient.request<IntegrationPlan>(
    `/sessions/${sessionId}/integration/${planId}`,
    {
      validator: IntegrationPlanSchema,
    },
  )
}


