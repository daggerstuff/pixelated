import { useState, useEffect, useCallback, useRef } from 'react'
import type { DocumentationSystem } from './DocumentationSystem'
import { createDocumentationSystem } from './DocumentationSystem'
import { createTogetherAIService } from '../ai/AIService'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { toast } from 'react-hot-toast'
import { AIRepository } from '../db/ai/repository'
import type { FHIRClient } from '../ehr/types'
import { createFHIRClient } from '../ehr/services/fhir.client'

// Import shared types to avoid circular dependencies
import type {
  SessionDocumentation,
  EHRExportOptions,
  EHRExportResult,
} from './types'

const logger = createBuildSafeLogger('documentation')

export interface TherapyAIOptions {
  readonly temperature?: number
  readonly maxTokens?: number
  readonly model?: string
  readonly includeEmotions?: boolean
  readonly includeInterventions?: boolean
}

export interface UseDocumentationState {
  readonly isLoading: boolean
  readonly error: Error | null
  readonly documentation: SessionDocumentation | null
  readonly isGenerating: boolean
  readonly isExporting: boolean
  readonly exportResult: EHRExportResult | null
}

export interface UseDocumentationActions {
  readonly loadDocumentation: (forceRefresh?: boolean) => Promise<void>
  readonly generateDocumentation: (options?: TherapyAIOptions) => Promise<void>
  readonly saveDocumentation: (doc: SessionDocumentation) => Promise<boolean>
  readonly exportToEHR: (options: EHRExportOptions) => Promise<EHRExportResult>
  readonly setupEHRIntegration: (providerId: string) => Promise<boolean>
  readonly clearError: () => void
  readonly reset: () => void
}

export type UseDocumentationReturn = UseDocumentationState &
  UseDocumentationActions

// EHR Service interface
interface EHRService {
  connect: (providerId: string) => Promise<void>
  getFHIRClient: (providerId: string) => FHIRClient
  disconnect: () => void
}

// Singleton instance cache with proper cleanup
let documentationSystemInstance: DocumentationSystem | null = null
let ehrServiceInstance: EHRService | null = null
let aiRepositoryInstance: AIRepository | null = null
let refCount = 0

const getAIRepositoryInstance = (): AIRepository => {
  if (!aiRepositoryInstance) {
    aiRepositoryInstance = new AIRepository()
  }
  return aiRepositoryInstance
}

const getDocumentationSystemInstance =
  async (): Promise<DocumentationSystem> => {
    if (!documentationSystemInstance) {
      const togetherService = createTogetherAIService({
        togetherApiKey: process.env['TOGETHER_API_KEY'] || '',
        apiKey: process.env['TOGETHER_API_KEY'] || '',
      })

      const aiService = {
        createChatCompletion:
          togetherService.createChatCompletion.bind(togetherService),
        createStreamingChatCompletion:
          togetherService.createStreamingChatCompletion.bind(togetherService),
        dispose: togetherService.dispose.bind(togetherService),
        getModelInfo: (model: string) => ({
          id: model,
          name: model,
          provider: 'together',
          capabilities: ['chat', 'completion'],
          contextWindow: 32768,
          maxTokens: 4096,
        }),
      }

      const aiRepository = getAIRepositoryInstance()
      documentationSystemInstance = createDocumentationSystem(
        aiRepository,
        aiService,
      )
    }
    refCount++
    return documentationSystemInstance
  }

const getEHRServiceInstance = async (): Promise<EHRService> => {
  if (!ehrServiceInstance) {
    const mockProvider = {
      id: 'mock-provider',
      name: 'Mock EHR Provider',
      vendor: 'epic' as const,
      baseUrl: 'https://mock-ehr.example.com/fhir',
      clientId: 'mock-client-id',
      clientSecret: 'mock-client-secret',
      scopes: ['patient/*.read', 'user/*.read'],
      initialize: () => {},
      cleanup: () => {},
    }

    ehrServiceInstance = {
      connect: async () => {},
      getFHIRClient: () => createFHIRClient(mockProvider),
      disconnect: () => {},
    }
  }
  return ehrServiceInstance
}

const releaseInstances = () => {
  refCount--
  if (refCount <= 0) {
    ehrServiceInstance?.disconnect?.()
    documentationSystemInstance = null
    ehrServiceInstance = null
    aiRepositoryInstance = null
    refCount = 0
  }
}

/**
 * Production-grade hook for documentation system interaction
 * Provides comprehensive session documentation management with error boundaries
 */
export function useDocumentation(sessionId: string): UseDocumentationReturn {
  // State management
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)
  const [documentation, setDocumentation] =
    useState<SessionDocumentation | null>(null)
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [exportResult, setExportResult] = useState<EHRExportResult | null>(null)

  // Refs for cleanup and abort control
  const abortControllerRef = useRef<AbortController | null>(null)
  const mountedRef = useRef<boolean>(true)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false
      abortControllerRef.current?.abort()
      releaseInstances()
    }
  }, [])

  // Utility functions
  const validateSessionId = useCallback((id: string): void => {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      throw new Error('Valid session ID is required')
    }
  }, [])

  const handleError = useCallback(
    (error: unknown, context: string): Error => {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      logger.error(`Documentation error in ${context}`, {
        error: errorObj,
        sessionId,
        context,
      })
      return errorObj
    },
    [sessionId],
  )

  const safeSetState = useCallback(
    <T>(setter: (value: T) => void, value: T): void => {
      if (mountedRef.current) {
        setter(value)
      }
    },
    [],
  )

  // Load documentation with proper error handling and abort support
  const loadDocumentation = useCallback(
    async (forceRefresh = false): Promise<void> => {
      try {
        validateSessionId(sessionId)

        // Cancel any existing operation
        abortControllerRef.current?.abort()
        abortControllerRef.current = new AbortController()

        safeSetState(setIsLoading, true)
        safeSetState(setError, null)

        const documentationSystem = await getDocumentationSystemInstance()
        const sessionDocumentation = await documentationSystem.getDocumentation(
          sessionId,
          forceRefresh,
        )

        if (abortControllerRef.current?.signal.aborted) {
          return
        }
        if (sessionDocumentation) {
          const docWithMeta = {
            ...sessionDocumentation,
            version: 1,
            lastModified: new Date(),
          }
          safeSetState(setDocumentation, docWithMeta)
        }
      } catch (error: unknown) {
        if (error instanceof Error && (error as Error)?.name === 'AbortError') {
          return
        }
        const errorObj = handleError(error, 'loadDocumentation')
        safeSetState(setError, errorObj)
      } finally {
        safeSetState(setIsLoading, false)
      }
    },
    [sessionId, validateSessionId, handleError, safeSetState],
  )

  // Generate documentation with progress tracking
  const generateDocumentation = useCallback(
    async (options?: TherapyAIOptions): Promise<void> => {
      try {
        validateSessionId(sessionId)

        abortControllerRef.current?.abort()
        abortControllerRef.current = new AbortController()

        safeSetState(setIsGenerating, true)
        safeSetState(setError, null)

        const documentationSystem = await getDocumentationSystemInstance()
        const sessionDocumentation =
          await documentationSystem.generateDocumentation(sessionId, options)

        if (abortControllerRef.current?.signal.aborted) {
          return
        }
        if (sessionDocumentation) {
          const docWithMeta = {
            ...sessionDocumentation,
            version: 1,
            lastModified: new Date(),
          }
          safeSetState(setDocumentation, docWithMeta)
        }

        toast.success('Documentation generated successfully')
      } catch (error: unknown) {
        if (error instanceof Error && (error as Error)?.name === 'AbortError') {
          return
        }
        const errorObj = handleError(error, 'generateDocumentation')
        safeSetState(setError, errorObj)
        toast.error('Failed to generate documentation')
      } finally {
        safeSetState(setIsGenerating, false)
      }
    },
    [sessionId, validateSessionId, handleError, safeSetState],
  )

  // Save documentation with validation and optimistic updates
  const saveDocumentation = useCallback(
    async (updatedDocumentation: SessionDocumentation): Promise<boolean> => {
      try {
        validateSessionId(sessionId)

        if (!updatedDocumentation) {
          throw new Error('Documentation data is required')
        }

        safeSetState(setIsLoading, true)
        safeSetState(setError, null)

        // Optimistic update
        const previousDoc = documentation
        safeSetState(setDocumentation, updatedDocumentation)

        const documentationSystem = await getDocumentationSystemInstance()
        const docToSave = {
          ...updatedDocumentation,
          interventions: [...updatedDocumentation.interventions],
        }
        const success = await documentationSystem.saveDocumentation(
          sessionId,
          docToSave,
        )

        if (!success && previousDoc) {
          // Revert on failure
          safeSetState(setDocumentation, previousDoc)
          toast.error('Failed to save documentation')
        } else if (success) {
          toast.success('Documentation saved successfully')
        }

        return success
      } catch (error: unknown) {
        const errorObj = handleError(error, 'saveDocumentation')
        safeSetState(setError, errorObj)
        toast.error('Failed to save documentation')
        return false
      } finally {
        safeSetState(setIsLoading, false)
      }
    },
    [sessionId, documentation, validateSessionId, handleError, safeSetState],
  )

  // EHR integration setup with proper validation
  const setupEHRIntegration = useCallback(
    async (providerId: string): Promise<boolean> => {
      try {
        if (!providerId || typeof providerId !== 'string') {
          throw new Error('Valid provider ID is required')
        }

        const ehrService = await getEHRServiceInstance()
        await ehrService.connect(providerId)

        const fhirClient = ehrService.getFHIRClient(providerId)
        const documentationSystem = await getDocumentationSystemInstance()
        if (documentationSystem.setupEHRIntegration) {
          documentationSystem.setupEHRIntegration(fhirClient)
        }

        toast.success(`Connected to EHR provider: ${providerId}`)
        return true
      } catch (error: unknown) {
        const errorObj = handleError(error, 'setupEHRIntegration')
        safeSetState(setError, errorObj)
        toast.error('Failed to set up EHR integration')
        return false
      }
    },
    [handleError, safeSetState],
  )

  // Export to EHR with comprehensive error handling
  const exportToEHR = useCallback(
    async (options: EHRExportOptions): Promise<EHRExportResult> => {
      const failureResult = (
        error: string,
        format: 'fhir' | 'ccda' | 'pdf',
        metadata: {
          exportedAt: Date
          exportedBy: string
          patientId: string
          providerId: string
        },
      ): EHRExportResult => ({
        success: false,
        errors: [error],
        format,
        metadata,
      })

      try {
        validateSessionId(sessionId)

        if (!options || !options.providerId || !options.format) {
          throw new Error('Valid export options are required')
        }

        safeSetState(setIsExporting, true)
        safeSetState(setError, null)
        safeSetState(setExportResult, null)

        // Ensure EHR integration is set up
        const setupSuccess = await setupEHRIntegration(options.providerId)
        if (!setupSuccess) {
          throw new Error('Failed to set up EHR integration')
        }

        const documentationSystem = await getDocumentationSystemInstance()
        const rawResult = (await documentationSystem.exportToEHR(
          sessionId,
          options,
        )) as unknown

        // Construct a fully type-safe EHRExportResult
        const result: EHRExportResult = {
          success:
            typeof rawResult.success === 'boolean' ? rawResult.success : false,
          format:
            typeof rawResult.format === 'string'
              ? rawResult.format
              : options.format,
          metadata:
            typeof rawResult.metadata === 'object' &&
            rawResult.metadata !== null
              ? rawResult.metadata
              : {
                  exportedAt: new Date(),
                  exportedBy: 'system',
                  patientId: options.patientId,
                  providerId: options.providerId,
                },
          ...(rawResult.data !== undefined ? { data: rawResult.data } : {}),
          ...(Array.isArray(rawResult.errors)
            ? { errors: rawResult.errors }
            : {}),
        }

        safeSetState(setExportResult, result)

        if (result.success) {
          toast.success(
            `Documentation exported successfully to ${options.format.toUpperCase()}`,
          )
        } else {
          const errorMsg =
            Array.isArray(result.errors) && result.errors.length > 0
              ? result.errors.join(', ')
              : 'Unknown error'
          toast.error(`Export failed: ${errorMsg}`)
        }

        return result
      } catch (error: unknown) {
        const errorObj = handleError(error, 'exportToEHR')
        // Fallbacks for format and metadata if options is not available
        const fallbackFormat: 'fhir' | 'ccda' | 'pdf' = options?.format || 'pdf'
        const fallbackMetadata = {
          exportedAt: new Date(),
          exportedBy: 'system',
          patientId: options?.patientId || '',
          providerId: options?.providerId || '',
        }
        const result = failureResult(
          errorObj.message,
          fallbackFormat,
          fallbackMetadata,
        )
        safeSetState(setError, errorObj)
        safeSetState(setExportResult, result)
        toast.error('Failed to export documentation')
        return result
      } finally {
        safeSetState(setIsExporting, false)
      }
    },
    [
      sessionId,
      setupEHRIntegration,
      validateSessionId,
      handleError,
      safeSetState,
    ],
  )

  // Clear error state
  const clearError = useCallback((): void => {
    safeSetState(setError, null)
  }, [safeSetState])

  // Reset all state
  const reset = useCallback((): void => {
    abortControllerRef.current?.abort()
    safeSetState(setIsLoading, false)
    safeSetState(setError, null)
    safeSetState(setDocumentation, null)
    safeSetState(setIsGenerating, false)
    safeSetState(setIsExporting, false)
    safeSetState(setExportResult, null)
  }, [safeSetState])

  // Auto-load documentation on mount or sessionId change
  useEffect(() => {
    if (sessionId) {
      loadDocumentation()
    }
  }, [sessionId, loadDocumentation])

  return {
    // State
    isLoading,
    error,
    documentation,
    isGenerating,
    isExporting,
    exportResult,
    // Actions
    loadDocumentation,
    generateDocumentation,
    saveDocumentation,
    exportToEHR,
    setupEHRIntegration,
    clearError,
    reset,
  }
}
