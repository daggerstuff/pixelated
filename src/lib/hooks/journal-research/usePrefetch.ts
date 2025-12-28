/**
 * Prefetching utilities for journal research data
 */

import { useQueryClient } from '@tanstack/react-query'
import { journalResearchQueryKeys } from '@/lib/api/journal-research/react-query'
import { useCallback } from 'react'

/**
 * Hook for prefetching journal research data
 */
export function usePrefetchJournalResearch() {
  const queryClient = useQueryClient()

  const prefetchSession = useCallback(
    async (sessionId: string) => {
      await queryClient.prefetchQuery({
        queryKey: journalResearchQueryKeys.sessions.detail(sessionId),
        // The actual queryFn should be provided by the hook that uses this
        // This is a utility for prefetching
      })
    },
    [queryClient],
  )

  const prefetchSessionList = useCallback(async () => {
    await queryClient.prefetchQuery({
      queryKey: journalResearchQueryKeys.sessions.list(),
    })
  }, [queryClient])

  const prefetchDiscovery = useCallback(
    async (sessionId: string) => {
      await queryClient.prefetchQuery({
        queryKey: journalResearchQueryKeys.discovery.list(sessionId),
      })
    },
    [queryClient],
  )

  const prefetchProgress = useCallback(
    async (sessionId: string) => {
      await queryClient.prefetchQuery({
        queryKey: journalResearchQueryKeys.progress.detail(sessionId),
      })
    },
    [queryClient],
  )

  return {
    prefetchSession,
    prefetchSessionList,
    prefetchDiscovery,
    prefetchProgress,
  }
}

/**
 * Prefetch on hover for better perceived performance
 */
export function usePrefetchOnHover() {
  const { prefetchSession } = usePrefetchJournalResearch()

  const handleMouseEnter = useCallback(
    (sessionId: string) => {
      // Prefetch on hover with a small delay to avoid unnecessary requests
      const timeoutId = setTimeout(() => {
        prefetchSession(sessionId)
      }, 200)

      return () => clearTimeout(timeoutId)
    },
    [prefetchSession],
  )

  return { handleMouseEnter }
}

