import type { DefaultOptions, MutationKey } from '@tanstack/react-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'

/**
 * Optimized query defaults for journal research module
 * - Longer stale times for relatively static data
 * - Shorter stale times for frequently updated data
 * - Optimized garbage collection times
 */
const baseQueryDefaults: DefaultOptions = {
  queries: {
    // Default stale time: 1 minute
    staleTime: 60_000,
    // Garbage collection time: 10 minutes (increased from 5)
    gcTime: 10 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: true,
  },
  mutations: {
    retry: 0,
  },
}

const createJournalResearchQueryClient = (defaultOptions?: DefaultOptions) => {
  const mergedDefaults: DefaultOptions = {
    queries: {
      ...baseQueryDefaults.queries,
      ...defaultOptions?.queries,
    },
    mutations: {
      ...baseQueryDefaults.mutations,
      ...defaultOptions?.mutations,
    },
  }

  const client = new QueryClient({
    defaultOptions: mergedDefaults,
  })

  // Configure cache size limits
  client.setQueryDefaults(['journal-research'], {
    gcTime: 10 * 60_000,
  })

  return client
}

type MutationKeyFactory = (...args: unknown[]) => MutationKey

const buildMutationKey =
  (...parts: unknown[]): MutationKeyFactory =>
  (...args) => [...parts, ...args]

export const journalResearchQueryKeys = {
  root: ['journal-research'] as const,
  sessions: {
    root: ['journal-research', 'sessions'] as const,
    list: (params?: unknown) =>
      ['journal-research', 'sessions', 'list', params ?? {}] as const,
    detail: (sessionId: string) =>
      ['journal-research', 'sessions', 'detail', sessionId] as const,
  },
  discovery: {
    root: ['journal-research', 'discovery'] as const,
    list: (sessionId: string, params?: unknown) =>
      ['journal-research', 'discovery', sessionId, params ?? {}] as const,
    detail: (sessionId: string, sourceId: string) =>
      ['journal-research', 'discovery', sessionId, 'detail', sourceId] as const,
  },
  evaluation: {
    root: ['journal-research', 'evaluation'] as const,
    list: (sessionId: string, params?: unknown) =>
      ['journal-research', 'evaluation', sessionId, params ?? {}] as const,
    detail: (sessionId: string, evaluationId: string) =>
      [
        'journal-research',
        'evaluation',
        sessionId,
        'detail',
        evaluationId,
      ] as const,
  },
  acquisition: {
    root: ['journal-research', 'acquisition'] as const,
    list: (sessionId: string, params?: unknown) =>
      ['journal-research', 'acquisition', sessionId, params ?? {}] as const,
    detail: (sessionId: string, acquisitionId: string) =>
      [
        'journal-research',
        'acquisition',
        sessionId,
        'detail',
        acquisitionId,
      ] as const,
  },
  integration: {
    root: ['journal-research', 'integration'] as const,
    list: (sessionId: string, params?: unknown) =>
      ['journal-research', 'integration', sessionId, params ?? {}] as const,
    detail: (sessionId: string, planId: string) =>
      ['journal-research', 'integration', sessionId, 'detail', planId] as const,
  },
  progress: {
    root: ['journal-research', 'progress'] as const,
    detail: (sessionId: string) =>
      ['journal-research', 'progress', sessionId] as const,
    metrics: (sessionId: string) =>
      ['journal-research', 'progress', sessionId, 'metrics'] as const,
  },
  reports: {
    root: ['journal-research', 'reports'] as const,
    list: (sessionId: string, params?: unknown) =>
      ['journal-research', 'reports', sessionId, params ?? {}] as const,
    detail: (sessionId: string, reportId: string) =>
      ['journal-research', 'reports', sessionId, 'detail', reportId] as const,
  },
  training: {
    root: ['journal-research', 'training'] as const,
    status: (sessionId: string) =>
      ['journal-research', 'training', 'status', sessionId] as const,
    pipelineStatus: () =>
      ['journal-research', 'training', 'pipeline-status'] as const,
  },
} as const

export const journalResearchMutationKeys = {
  root: buildMutationKey('journal-research'),
  sessions: {
    create: buildMutationKey('journal-research', 'sessions', 'create'),
    update: buildMutationKey('journal-research', 'sessions', 'update'),
    delete: buildMutationKey('journal-research', 'sessions', 'delete'),
  },
  discovery: {
    initiate: buildMutationKey('journal-research', 'discovery', 'initiate'),
  },
  evaluation: {
    initiate: buildMutationKey('journal-research', 'evaluation', 'initiate'),
    update: buildMutationKey('journal-research', 'evaluation', 'update'),
  },
  acquisition: {
    initiate: buildMutationKey('journal-research', 'acquisition', 'initiate'),
    update: buildMutationKey('journal-research', 'acquisition', 'update'),
  },
  integration: {
    initiate: buildMutationKey('journal-research', 'integration', 'initiate'),
  },
  reports: {
    generate: buildMutationKey('journal-research', 'reports', 'generate'),
  },
  training: {
    integrate: buildMutationKey('journal-research', 'training', 'integrate'),
    integrateAll: buildMutationKey(
      'journal-research',
      'training',
      'integrate-all',
    ),
  },
} as const

interface JournalResearchQueryProviderProps {
  children: ReactNode
  client?: QueryClient
  defaultOptions?: DefaultOptions
}

export function JournalResearchQueryProvider({
  children,
  client,
  defaultOptions,
}: JournalResearchQueryProviderProps) {
  const [statefulClient] = useState(
    () => client ?? createJournalResearchQueryClient(defaultOptions),
  )
  const memoizedClient = useMemo(() => statefulClient, [statefulClient])

  return (
    <QueryClientProvider client={memoizedClient}>
      {children}
    </QueryClientProvider>
  )
}
