/**
 * React hooks for the Bias Audit feature
 *
 * Provides TanStack Query hooks for managing dataset bias audits,
 * quarantine workflows, and real-time audit progress tracking.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback, useEffect } from 'react'
import {
  getBiasAuditService,
  type BiasAuditServiceConfig,
} from '@/lib/services/bias-audit-service'
import type {
  DatasetForAudit,
  DatasetAuditResult,
  AuditConfig,
  AuditSummary,
  QuarantineActionPayload,
  AuditHistoryEntry,
  QuarantineStatus,
  AuditProgressUpdate,
} from '@/lib/api/journal-research/bias-audit-types'

// Query keys
export const biasAuditKeys = {
  all: ['bias-audit'] as const,
  summary: () => [...biasAuditKeys.all, 'summary'] as const,
  datasets: () => [...biasAuditKeys.all, 'datasets'] as const,
  datasetsList: (filters: { status?: QuarantineStatus; page?: number; pageSize?: number }) =>
    [...biasAuditKeys.datasets(), filters] as const,
  dataset: (id: string) => [...biasAuditKeys.datasets(), id] as const,
  auditResults: () => [...biasAuditKeys.all, 'audit-results'] as const,
  auditResult: (id: string) => [...biasAuditKeys.auditResults(), id] as const,
  auditResultsForDataset: (datasetId: string) =>
    [...biasAuditKeys.auditResults(), 'dataset', datasetId] as const,
  history: (datasetId: string) => [...biasAuditKeys.all, 'history', datasetId] as const,
}

/**
 * Hook for fetching audit summary statistics
 */
export function useAuditSummary() {
  const service = getBiasAuditService()

  return useQuery<AuditSummary, Error>({
    queryKey: biasAuditKeys.summary(),
    queryFn: () => service.getAuditSummary(),
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refresh every minute
  })
}

/**
 * Hook for fetching datasets pending audit
 */
export function useDatasetsForAudit(options: {
  status?: QuarantineStatus
  page?: number
  pageSize?: number
} = {}) {
  const service = getBiasAuditService()
  const { status, page = 1, pageSize = 20 } = options

  return useQuery({
    queryKey: biasAuditKeys.datasetsList({ status, page, pageSize }),
    queryFn: () => service.getDatasetsForAudit({ status, page, pageSize }),
    staleTime: 30000,
  })
}

/**
 * Hook for fetching a specific dataset
 */
export function useDataset(datasetId: string | null) {
  const service = getBiasAuditService()

  return useQuery<DatasetForAudit | null, Error>({
    queryKey: biasAuditKeys.dataset(datasetId ?? ''),
    queryFn: () => (datasetId ? service.getDataset(datasetId) : null),
    enabled: Boolean(datasetId),
    staleTime: 30000,
  })
}

/**
 * Hook for fetching audit result by ID
 */
export function useAuditResult(auditId: string | null) {
  const service = getBiasAuditService()

  return useQuery<DatasetAuditResult | null, Error>({
    queryKey: biasAuditKeys.auditResult(auditId ?? ''),
    queryFn: () => (auditId ? service.getAuditResult(auditId) : null),
    enabled: Boolean(auditId),
    staleTime: 60000,
  })
}

/**
 * Hook for fetching audit results for a dataset
 */
export function useAuditResultsForDataset(datasetId: string | null) {
  const service = getBiasAuditService()

  return useQuery<DatasetAuditResult[], Error>({
    queryKey: biasAuditKeys.auditResultsForDataset(datasetId ?? ''),
    queryFn: () => (datasetId ? service.getAuditResultsForDataset(datasetId) : []),
    enabled: Boolean(datasetId),
    staleTime: 30000,
  })
}

/**
 * Hook for fetching audit history for a dataset
 */
export function useAuditHistory(datasetId: string | null) {
  const service = getBiasAuditService()

  return useQuery<AuditHistoryEntry[], Error>({
    queryKey: biasAuditKeys.history(datasetId ?? ''),
    queryFn: () => (datasetId ? service.getAuditHistory(datasetId) : []),
    enabled: Boolean(datasetId),
    staleTime: 30000,
  })
}

/**
 * Hook for registering a new dataset
 */
export function useRegisterDataset() {
  const queryClient = useQueryClient()
  const service = getBiasAuditService()

  return useMutation({
    mutationFn: (dataset: Omit<DatasetForAudit, 'quarantineStatus'>) =>
      service.registerDataset(dataset),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: biasAuditKeys.datasets() })
      queryClient.invalidateQueries({ queryKey: biasAuditKeys.summary() })
    },
  })
}

/**
 * Hook for initiating bias audit with progress tracking
 */
export function useInitiateAudit() {
  const queryClient = useQueryClient()
  const [progressUpdates, setProgressUpdates] = useState<Map<string, AuditProgressUpdate>>(
    new Map()
  )

  const handleProgressUpdate = useCallback((update: AuditProgressUpdate) => {
    setProgressUpdates((prev) => {
      const next = new Map(prev)
      next.set(update.datasetId, update)
      return next
    })
  }, [])

  const service = getBiasAuditService({
    onProgressUpdate: handleProgressUpdate,
  })

  const mutation = useMutation({
    mutationFn: async ({
      datasetIds,
      config,
    }: {
      datasetIds: string[]
      config?: Partial<AuditConfig>
    }) => {
      // Clear previous progress for these datasets
      setProgressUpdates((prev) => {
        const next = new Map(prev)
        for (const id of datasetIds) {
          next.delete(id)
        }
        return next
      })

      return service.initiateAudit(datasetIds, config)
    },
    onSuccess: (results) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: biasAuditKeys.datasets() })
      queryClient.invalidateQueries({ queryKey: biasAuditKeys.summary() })
      queryClient.invalidateQueries({ queryKey: biasAuditKeys.auditResults() })

      // Set individual results in cache
      for (const result of results) {
        queryClient.setQueryData(biasAuditKeys.auditResult(result.auditId), result)
        queryClient.setQueryData(biasAuditKeys.dataset(result.datasetId), (old: DatasetForAudit | undefined) => {
          if (!old) return old
          return {
            ...old,
            lastAuditId: result.auditId,
            lastAuditScore: result.overallBiasScore,
            quarantineStatus: result.quarantineStatus,
          }
        })
      }
    },
    onError: () => {
      // Clear progress on error
      setProgressUpdates(new Map())
    },
  })

  const clearProgress = useCallback(() => {
    setProgressUpdates(new Map())
  }, [])

  return {
    ...mutation,
    progressUpdates,
    clearProgress,
    getProgress: (datasetId: string) => progressUpdates.get(datasetId),
  }
}

/**
 * Hook for processing quarantine actions
 */
export function useQuarantineAction() {
  const queryClient = useQueryClient()
  const service = getBiasAuditService()

  return useMutation({
    mutationFn: (payload: QuarantineActionPayload) => service.processQuarantineAction(payload),
    onSuccess: (updatedDataset) => {
      // Update the dataset in cache
      queryClient.setQueryData(
        biasAuditKeys.dataset(updatedDataset.datasetId),
        updatedDataset
      )

      // Invalidate lists and summary
      queryClient.invalidateQueries({ queryKey: biasAuditKeys.datasets() })
      queryClient.invalidateQueries({ queryKey: biasAuditKeys.summary() })
      queryClient.invalidateQueries({
        queryKey: biasAuditKeys.history(updatedDataset.datasetId),
      })
    },
  })
}

/**
 * Combined hook for bias audit dashboard state
 */
export function useBiasAuditDashboard() {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null)
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<QuarantineStatus | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const summaryQuery = useAuditSummary()
  const datasetsQuery = useDatasetsForAudit({ status: statusFilter, page, pageSize })
  const selectedDatasetQuery = useDataset(selectedDatasetId)
  const selectedAuditQuery = useAuditResult(selectedAuditId)
  const historyQuery = useAuditHistory(selectedDatasetId)

  const initiateAuditMutation = useInitiateAudit()
  const quarantineActionMutation = useQuarantineAction()

  // Auto-select audit when dataset changes
  useEffect(() => {
    if (selectedDatasetQuery.data?.lastAuditId) {
      setSelectedAuditId(selectedDatasetQuery.data.lastAuditId)
    } else {
      setSelectedAuditId(null)
    }
  }, [selectedDatasetQuery.data?.lastAuditId])

  const selectDataset = useCallback((datasetId: string | null) => {
    setSelectedDatasetId(datasetId)
    if (!datasetId) {
      setSelectedAuditId(null)
    }
  }, [])

  const initiateAudit = useCallback(
    async (datasetIds: string[], config?: Partial<AuditConfig>) => {
      const results = await initiateAuditMutation.mutateAsync({ datasetIds, config })
      if (results.length > 0) {
        setSelectedDatasetId(results[0].datasetId)
        setSelectedAuditId(results[0].auditId)
      }
      return results
    },
    [initiateAuditMutation]
  )

  const processQuarantineAction = useCallback(
    async (action: QuarantineActionPayload['action'], reason?: string) => {
      if (!selectedDatasetId) {
        throw new Error('No dataset selected')
      }
      return quarantineActionMutation.mutateAsync({
        datasetId: selectedDatasetId,
        action,
        reason,
        reviewedBy: 'current_user', // Would come from auth context in production
      })
    },
    [selectedDatasetId, quarantineActionMutation]
  )

  return {
    // State
    selectedDatasetId,
    selectedAuditId,
    statusFilter,
    page,
    pageSize,

    // Setters
    selectDataset,
    setSelectedAuditId,
    setStatusFilter,
    setPage,
    setPageSize,

    // Queries
    summary: summaryQuery.data,
    summaryLoading: summaryQuery.isLoading,
    summaryError: summaryQuery.error,

    datasets: datasetsQuery.data,
    datasetsLoading: datasetsQuery.isLoading,
    datasetsError: datasetsQuery.error,

    selectedDataset: selectedDatasetQuery.data,
    selectedDatasetLoading: selectedDatasetQuery.isLoading,

    selectedAudit: selectedAuditQuery.data,
    selectedAuditLoading: selectedAuditQuery.isLoading,

    history: historyQuery.data ?? [],
    historyLoading: historyQuery.isLoading,

    // Mutations
    initiateAudit,
    initiateAuditLoading: initiateAuditMutation.isPending,
    auditProgress: initiateAuditMutation.progressUpdates,

    processQuarantineAction,
    quarantineActionLoading: quarantineActionMutation.isPending,

    // Refresh
    refresh: () => {
      summaryQuery.refetch()
      datasetsQuery.refetch()
      if (selectedDatasetId) {
        selectedDatasetQuery.refetch()
        historyQuery.refetch()
      }
      if (selectedAuditId) {
        selectedAuditQuery.refetch()
      }
    },
  }
}
