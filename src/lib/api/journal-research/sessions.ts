import { journalResearchApiClient } from './client'
import {
  CreateSessionPayload,
  Session,
  SessionList,
  SessionListSchema,
  SessionSchema,
  UpdateSessionPayload,
  serializeCreateSessionPayload,
  serializeUpdateSessionPayload,
} from './types'

export interface ListSessionsParams {
  page?: number
  pageSize?: number
}

export async function listSessions(
  params: ListSessionsParams = {},
): Promise<SessionList> {
  const { page, pageSize } = params
  return journalResearchApiClient.request<SessionList>('/sessions', {
    params: {
      page,
      page_size: pageSize,
    },
    validator: SessionListSchema,
  })
}

export async function getSession(sessionId: string): Promise<Session> {
  return journalResearchApiClient.request<Session>(`/sessions/${sessionId}`, {
    validator: SessionSchema,
  })
}

export async function createSession(
  payload: CreateSessionPayload,
): Promise<Session> {
  return journalResearchApiClient.request<Session>('/sessions', {
    method: 'POST',
    body: serializeCreateSessionPayload(payload),
    validator: SessionSchema,
  })
}

export async function updateSession(
  sessionId: string,
  payload: UpdateSessionPayload,
): Promise<Session> {
  return journalResearchApiClient.request<Session>(`/sessions/${sessionId}`, {
    method: 'PUT',
    body: serializeUpdateSessionPayload(payload),
    validator: SessionSchema,
  })
}

export async function deleteSession(sessionId: string): Promise<void> {
  await journalResearchApiClient.request(`/sessions/${sessionId}`, {
    method: 'DELETE',
  })
}


