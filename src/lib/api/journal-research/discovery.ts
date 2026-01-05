import { journalResearchApiClient } from './client'
import {
  DiscoveryInitiatePayload,
  DiscoveryResponse,
  DiscoveryResponseSchema,
  Source,
  SourceList,
  SourceListSchema,
  SourceSchema,
  serializeDiscoveryInitiatePayload,
} from './types'

export interface ListSourcesParams {
  page?: number
  pageSize?: number
}

export async function initiateDiscovery(
  sessionId: string,
  payload: DiscoveryInitiatePayload,
): Promise<DiscoveryResponse> {
  return journalResearchApiClient.request<DiscoveryResponse>(
    `/sessions/${sessionId}/discovery`,
    {
      method: 'POST',
      body: serializeDiscoveryInitiatePayload(payload),
      validator: DiscoveryResponseSchema,
    },
  )
}

export async function listSources(
  sessionId: string,
  params: ListSourcesParams = {},
): Promise<SourceList> {
  const { page, pageSize } = params
  return journalResearchApiClient.request<SourceList>(
    `/sessions/${sessionId}/discovery/sources`,
    {
      params: {
        page,
        page_size: pageSize,
      },
      validator: SourceListSchema,
    },
  )
}

export async function getSource(
  sessionId: string,
  sourceId: string,
): Promise<Source> {
  return journalResearchApiClient.request<Source>(
    `/sessions/${sessionId}/discovery/sources/${sourceId}`,
    {
      validator: SourceSchema,
    },
  )
}


