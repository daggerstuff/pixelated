/**
 * Training Pipeline Integration API
 * 
 * Provides methods for integrating journal research datasets into the training pipeline.
 */

import { journalResearchApiClient } from './client'


export interface TrainingIntegrationResult {
  success: boolean
  source_id: string
  session_id?: string
  result?: {
    success: boolean
    source_id: string
    [key: string]: unknown
  }
  error?: string
}

export interface TrainingSessionStatus {
  session_id: string
  pipeline_available: boolean
  total_datasets: number
  integrated_datasets: number
  datasets: Array<{
    source_id: string
    integrated: boolean
    integration_status?: unknown
  }>
}

export interface TrainingPipelineStatus {
  available: boolean
  total_datasets?: number
  completed_datasets?: number
  failed_datasets?: number
  total_conversations?: number
  accepted_conversations?: number
  rejected_conversations?: number
  journal_research_datasets?: number
  current_stage?: string
  message?: string
  error?: string
}

export interface IntegrateAllResult {
  success: boolean
  integrated: number
  failed: number
  total: number
  results: Array<{
    source_id: string
    success: boolean
    result?: unknown
    error?: string
  }>
  message?: string
}

/**
 * Integrate a single dataset into the training pipeline
 */
export async function integrateDataset(
  sessionId: string,
  sourceId: string,
  autoIntegrate: boolean = true,
): Promise<TrainingIntegrationResult> {
  const response = await journalResearchApiClient.request<TrainingIntegrationResult>(
    `sessions/${sessionId}/training/integrate/${sourceId}`,
    {
      method: 'POST',
      body: JSON.stringify({ auto_integrate: autoIntegrate }),
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
  return response
}

/**
 * Get training pipeline status for a session
 */
export async function getTrainingStatus(
  sessionId: string,
): Promise<TrainingSessionStatus> {
  const response = await journalResearchApiClient.request<TrainingSessionStatus>(
    `sessions/${sessionId}/training/status`,
    {
      method: 'GET',
    },
  )
  return response
}

/**
 * Integrate all acquired datasets from a session into the training pipeline
 */
export async function integrateAllDatasets(
  sessionId: string,
  autoIntegrate: boolean = true,
): Promise<IntegrateAllResult> {
  const response = await journalResearchApiClient.request<IntegrateAllResult>(
    `sessions/${sessionId}/training/integrate-all`,
    {
      method: 'POST',
      body: JSON.stringify({ auto_integrate: autoIntegrate }),
    },
  )
  return response
}

/**
 * Get overall training pipeline status
 */
export async function getPipelineStatus(): Promise<TrainingPipelineStatus> {
  const response = await journalResearchApiClient.request<TrainingPipelineStatus>(
    'training/pipeline-status',
    {
      method: 'GET',
    },
  )
  return response
}

