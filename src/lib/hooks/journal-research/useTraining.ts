/**
 * React hooks for training pipeline integration
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  integrateDataset,
  integrateAllDatasets,
  getTrainingStatus,
  getPipelineStatus,
  } from '@/lib/api/journal-research/training'
import { journalResearchQueryKeys, journalResearchMutationKeys } from '@/lib/api/journal-research/react-query'

/**
 * Hook for integrating a single dataset into the training pipeline
 */
export function useIntegrateDataset(sessionId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: journalResearchMutationKeys.training.integrate(sessionId),
    mutationFn: async ({
      sourceId,
      autoIntegrate = true,
    }: {
      sourceId: string
      autoIntegrate?: boolean
    }) => {
      return integrateDataset(sessionId, sourceId, autoIntegrate)
    },
    onSuccess: () => {
      // Invalidate training status queries
      queryClient.invalidateQueries({
        queryKey: journalResearchQueryKeys.training.status(sessionId),
      })
      queryClient.invalidateQueries({
        queryKey: journalResearchQueryKeys.training.pipelineStatus(),
      })
      // Also invalidate acquisition queries to refresh integration status
      queryClient.invalidateQueries({
        queryKey: journalResearchQueryKeys.acquisition.list(sessionId),
      })
    },
  })
}

/**
 * Hook for integrating all datasets from a session
 */
export function useIntegrateAllDatasets(sessionId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: journalResearchMutationKeys.training.integrateAll(sessionId),
    mutationFn: async (autoIntegrate: boolean = true) => {
      return integrateAllDatasets(sessionId, autoIntegrate)
    },
    onSuccess: () => {
      // Invalidate training status queries
      queryClient.invalidateQueries({
        queryKey: journalResearchQueryKeys.training.status(sessionId),
      })
      queryClient.invalidateQueries({
        queryKey: journalResearchQueryKeys.training.pipelineStatus(),
      })
      // Also invalidate acquisition queries
      queryClient.invalidateQueries({
        queryKey: journalResearchQueryKeys.acquisition.list(sessionId),
      })
    },
  })
}

/**
 * Hook for getting training pipeline status for a session
 */
export function useTrainingStatus(sessionId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: journalResearchQueryKeys.training.status(sessionId),
    queryFn: () => getTrainingStatus(sessionId),
    enabled: enabled && !!sessionId,
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // Refetch every 30 seconds
  })
}

/**
 * Hook for getting overall training pipeline status
 */
export function usePipelineStatus(enabled: boolean = true) {
  return useQuery({
    queryKey: journalResearchQueryKeys.training.pipelineStatus(),
    queryFn: () => getPipelineStatus(),
    enabled,
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // Refetch every 30 seconds
  })
}

