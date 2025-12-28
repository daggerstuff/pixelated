import { journalResearchApiClient } from './client'
import {
  Acquisition,
  AcquisitionInitiatePayload,
  AcquisitionList,
  AcquisitionListSchema,
  AcquisitionSchema,
  AcquisitionUpdatePayload,
  serializeAcquisitionInitiatePayload,
  serializeAcquisitionUpdatePayload,
} from './types'

export interface ListAcquisitionsParams {
  page?: number
  pageSize?: number
}

export async function initiateAcquisition(
  sessionId: string,
  payload: AcquisitionInitiatePayload,
): Promise<Acquisition> {
  return journalResearchApiClient.request<Acquisition>(
    `/sessions/${sessionId}/acquisition`,
    {
      method: 'POST',
      body: serializeAcquisitionInitiatePayload(payload),
      validator: AcquisitionSchema,
    },
  )
}

export async function listAcquisitions(
  sessionId: string,
  params: ListAcquisitionsParams = {},
): Promise<AcquisitionList> {
  const { page, pageSize } = params
  return journalResearchApiClient.request<AcquisitionList>(
    `/sessions/${sessionId}/acquisition`,
    {
      params: {
        page,
        page_size: pageSize,
      },
      validator: AcquisitionListSchema,
    },
  )
}

export async function getAcquisition(
  sessionId: string,
  acquisitionId: string,
): Promise<Acquisition> {
  return journalResearchApiClient.request<Acquisition>(
    `/sessions/${sessionId}/acquisition/${acquisitionId}`,
    {
      validator: AcquisitionSchema,
    },
  )
}

export async function updateAcquisition(
  sessionId: string,
  acquisitionId: string,
  payload: AcquisitionUpdatePayload,
): Promise<Acquisition> {
  return journalResearchApiClient.request<Acquisition>(
    `/sessions/${sessionId}/acquisition/${acquisitionId}`,
    {
      method: 'PUT',
      body: serializeAcquisitionUpdatePayload(payload),
      validator: AcquisitionSchema,
    },
  )
}


