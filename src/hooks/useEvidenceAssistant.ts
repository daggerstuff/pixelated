import { useCallback, useEffect, useRef, useState } from 'react'

import type {
  EvidenceAssistantRequest,
  EvidenceAssistantResponse,
} from '@/lib/api/evidence-assistant'
import {
  getEvidenceAssistantMetadata,
  searchEvidenceAssistant,
} from '@/lib/api/evidence-assistant'

type UseEvidenceAssistantState = {
  loading: boolean
  error: Error | null
  response: EvidenceAssistantResponse | null
  groundedAnswerEnabled: boolean | null
}

export function useEvidenceAssistant() {
  const [state, setState] = useState<UseEvidenceAssistantState>({
    loading: false,
    error: null,
    response: null,
    groundedAnswerEnabled: null,
  })
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadMetadata = async () => {
      try {
        const metadata = await getEvidenceAssistantMetadata(controller.signal)

        setState((current) => ({
          ...current,
          groundedAnswerEnabled: metadata.availableProviders.length > 0,
        }))
      } catch (_error) {
        // Keep grounded answer enabled by default if metadata fetch fails.
        setState((current) => ({
          ...current,
          groundedAnswerEnabled: null,
        }))
      }
    }

    void loadMetadata()

    return () => {
      controller.abort()
    }
  }, [])

  const search = useCallback(
    async (request: EvidenceAssistantRequest): Promise<EvidenceAssistantResponse> => {
      abortControllerRef.current?.abort()
      abortControllerRef.current = new AbortController()

      setState((current) => ({
        ...current,
        loading: true,
        error: null,
        response: null,
      }))

      try {
        const response = await searchEvidenceAssistant(
          request,
          abortControllerRef.current.signal,
        )

        setState((current) => ({
          ...current,
          loading: false,
          error: null,
          response,
        }))

        return response
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw error
        }

        const normalizedError =
          error instanceof Error ? error : new Error('Evidence assistant failed')

        setState((current) => ({
          ...current,
          loading: false,
          error: normalizedError,
          response: null,
        }))

        throw normalizedError
      }
    },
    [],
  )

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort()
    setState((current) => ({
      ...current,
      loading: false,
    }))
  }, [])

  const reset = useCallback(() => {
    setState((current) => ({
      ...current,
      loading: false,
      error: null,
      response: null,
    }))
  }, [])

  return {
    ...state,
    search,
    cancel,
    reset,
    groundedAnswerAvailable: state.groundedAnswerEnabled,
  }
}
