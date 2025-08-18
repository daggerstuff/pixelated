import type { AIMessage, TherapeuticResponse } from '../../../lib/ai/models/ai-types'
import type { AIStreamChunk } from '../../../lib/ai/models/ai-types'
import { useCallback, useState, useRef } from 'react'

interface UseResponseGenerationOptions {
  apiEndpoint?: string
  model?: string
  temperature?: number
  maxTokens?: number
  responseType?: 'general' | 'therapeutic' | 'creative' | 'analytical'
  streamingEnabled?: boolean
  systemPrompt?: string
  onError?: (error: Error) => void
  onComplete?: (response: string) => void
  onProgress?: (chunk: string, accumulated: string) => void
  onTherapeuticInsights?: (insights: TherapeuticResponse) => void
}

interface UseResponseGenerationResult {
  response: string
  isLoading: boolean
  isStreaming: boolean
  error: string | null
  progress: number
  therapeuticInsights: TherapeuticResponse | null
  generateResponse: (prompt: string, context?: AIMessage[]) => Promise<string | null>
  generateTherapeuticResponse: (
    prompt: string,
    sessionContext?: Record<string, unknown>
  ) => Promise<TherapeuticResponse | null>
  generateStreamingResponse: (
    prompt: string,
    context?: AIMessage[]
  ) => AsyncGenerator<string, string, unknown>
  regenerateLastResponse: () => Promise<string | null>
  stopGeneration: () => void
  reset: () => void
}

interface ResponseGenerationRequest {
  prompt: string
  model: string
  temperature: number
  maxTokens: number
  responseType: string
  systemPrompt?: string
  context?: AIMessage[]
  stream?: boolean
  sessionContext?: Record<string, unknown>
}

/**
 * Checks if an error is retryable for response generation
 */
function isRetryableError(error: unknown): boolean {
  // Network errors are retryable
  if (error instanceof TypeError && String(error).includes('network')) {
    return true
  }

  // Server errors (5xx) are retryable
  if (
    error instanceof Error &&
    'status' in error &&
    typeof error.status === 'number'
  ) {
    return error.status >= 500 && error.status < 600
  }

  // Rate limit errors (429) are retryable with backoff
  if (
    error instanceof Error &&
    'status' in error &&
    error.status === 429
  ) {
    return true
  }

  return false
}

/**
 * Generate system prompts based on response type
 */
function getSystemPrompt(responseType: string, customPrompt?: string): string {
  if (customPrompt) {
    return customPrompt
  }

  const prompts = {
    general: 'You are a helpful AI assistant. Provide clear, accurate, and helpful responses.',
    therapeutic: `You are a compassionate AI therapeutic assistant. Provide supportive, empathetic responses that help users process their emotions and thoughts. Use evidence-based therapeutic techniques when appropriate. Always prioritize user safety and well-being.`,
    creative: 'You are a creative AI assistant. Generate imaginative, inspiring, and original content. Think outside the box and explore creative possibilities.',
    analytical: 'You are an analytical AI assistant. Provide thorough, logical, and data-driven responses. Break down complex problems and offer structured solutions.',
  }

  return prompts[responseType as keyof typeof prompts] || prompts.general
}

/**
 * Custom hook for AI response generation with advanced features
 */
export function useResponseGeneration({
  apiEndpoint = '/api/ai/generate',
  model = 'gpt-4o',
  temperature = 0.7,
  maxTokens = 2048,
  responseType = 'general',
  streamingEnabled = true,
  systemPrompt,
  onError,
  onComplete,
  onProgress,
  onTherapeuticInsights,
}: UseResponseGenerationOptions = {}): UseResponseGenerationResult {
  const [response, setResponse] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<number>(0)
  const [therapeuticInsights, setTherapeuticInsights] = useState<TherapeuticResponse | null>(null)
  
  // Store last request for regeneration
  const lastRequestRef = useRef<ResponseGenerationRequest | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Reset all state
  const reset = useCallback(() => {
    setResponse('')
    setIsLoading(false)
    setIsStreaming(false)
    setError(null)
    setProgress(0)
    setTherapeuticInsights(null)
    lastRequestRef.current = null
    
    // Abort any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  // Stop ongoing generation
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsLoading(false)
    setIsStreaming(false)
  }, [])

  // Core function to make API request
  const makeRequest = useCallback(
    async (requestData: ResponseGenerationRequest): Promise<Response> => {
      // Create new abort controller for this request
      abortControllerRef.current = new AbortController()
      
      const timeoutId = setTimeout(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }
      }, 60000) // 60-second timeout

      try {
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...requestData,
            systemPrompt: getSystemPrompt(requestData.responseType, requestData.systemPrompt),
          }),
          signal: abortControllerRef.current.signal,
        })

        clearTimeout(timeoutId)
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `API request failed: ${response.status}`)
        }

        return response
      } catch (err: unknown) {
        clearTimeout(timeoutId)
        throw err
      }
    },
    [apiEndpoint]
  )

  // Generate a standard response
  const generateResponse = useCallback(
    async (prompt: string, context?: AIMessage[]): Promise<string | null> => {
      if (!prompt.trim() || isLoading) {
        return null
      }

      const requestData: ResponseGenerationRequest = {
        prompt,
        model,
        temperature,
        maxTokens,
        responseType,
        systemPrompt,
        context,
        stream: false,
      }

      lastRequestRef.current = requestData
      setIsLoading(true)
      setError(null)
      setProgress(0)

      // Implement retry logic with exponential backoff
      const MAX_RETRIES = 3
      let retries = 0

      while (retries < MAX_RETRIES) {
        try {
          const response = await makeRequest(requestData)
          const data = await response.json()

          const generatedResponse = data.response || data.content || ''
          setResponse(generatedResponse)
          setProgress(100)

          // Handle therapeutic insights if available
          if (data.therapeuticInsights && responseType === 'therapeutic') {
            setTherapeuticInsights(data.therapeuticInsights)
            if (onTherapeuticInsights) {
              onTherapeuticInsights(data.therapeuticInsights)
            }
          }

          if (onComplete) {
            onComplete(generatedResponse)
          }

          return generatedResponse
        } catch (err: unknown) {
          if (retries === MAX_RETRIES - 1 || !isRetryableError(err)) {
            const errorMessage =
              err instanceof Error ? (err as Error)?.message || String(err) : 'Failed to generate response'
            setError(errorMessage)

            if (onError && err instanceof Error) {
              onError(err)
            }
            return null
          }

          retries++
          // Exponential backoff with jitter
          const delay = Math.min(1000 * Math.pow(2, retries) + Math.random() * 1000, 10000)
          await new Promise((resolve) => setTimeout(resolve, delay))
        } finally {
          if (retries === MAX_RETRIES - 1) {
            setIsLoading(false)
          }
        }
      }

      return null
    },
    [
      isLoading,
      model,
      temperature,
      maxTokens,
      responseType,
      systemPrompt,
      onError,
      onComplete,
      onTherapeuticInsights,
      makeRequest,
    ]
  )

  // Generate a therapeutic response with specialized handling
  const generateTherapeuticResponse = useCallback(
    async (
      prompt: string,
      sessionContext?: Record<string, unknown>
    ): Promise<TherapeuticResponse | null> => {
      if (!prompt.trim() || isLoading) {
        return null
      }

      const requestData: ResponseGenerationRequest = {
        prompt,
        model,
        temperature: Math.min(temperature, 0.8), // Lower temperature for therapeutic responses
        maxTokens,
        responseType: 'therapeutic',
        systemPrompt,
        sessionContext,
        stream: false,
      }

      lastRequestRef.current = requestData
      setIsLoading(true)
      setError(null)

      try {
        const response = await makeRequest(requestData)
        const data = await response.json()

        const therapeuticResponse: TherapeuticResponse = {
          content: data.response || data.content || '',
          confidence: data.confidence || 0.8,
          intervention: data.intervention || false,
          techniques: data.techniques || [],
          usage: data.usage,
        }

        setResponse(therapeuticResponse.content)
        setTherapeuticInsights(therapeuticResponse)

        if (onTherapeuticInsights) {
          onTherapeuticInsights(therapeuticResponse)
        }

        if (onComplete) {
          onComplete(therapeuticResponse.content)
        }

        return therapeuticResponse
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? (err as Error)?.message || String(err) : 'Failed to generate therapeutic response'
        setError(errorMessage)

        if (onError && err instanceof Error) {
          onError(err)
        }
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [
      isLoading,
      model,
      temperature,
      maxTokens,
      systemPrompt,
      onError,
      onComplete,
      onTherapeuticInsights,
      makeRequest,
    ]
  )

  // Generate streaming response
  const generateStreamingResponse = useCallback(
    async function* (
      prompt: string,
      context?: AIMessage[]
    ): AsyncGenerator<string, string, unknown> {
      if (!prompt.trim() || isLoading || !streamingEnabled) {
        return ''
      }

      const requestData: ResponseGenerationRequest = {
        prompt,
        model,
        temperature,
        maxTokens,
        responseType,
        systemPrompt,
        context,
        stream: true,
      }

      lastRequestRef.current = requestData
      setIsLoading(true)
      setIsStreaming(true)
      setError(null)
      setProgress(0)

      let accumulatedResponse = ''

      try {
        const response = await makeRequest(requestData)
        const reader = response.body?.getReader()
        
        if (!reader) {
          throw new Error('No response body reader available')
        }

        const decoder = new TextDecoder('utf-8')

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          const chunk = decoder.decode(value)
          const lines = chunk
            .split('\n')
            .filter((line) => line.trim() !== '')
            .map((line) => line.replace(/^data: /, '').trim())

          for (const line of lines) {
            if (line === '[DONE]') {
              break
            }

            try {
              const data = JSON.parse(line) as any as AIStreamChunk
              const content = data?.content || ''

              if (content) {
                accumulatedResponse += content
                setResponse(accumulatedResponse)

                // Update progress based on estimated completion
                const estimatedProgress = Math.min(
                  (accumulatedResponse.length / maxTokens) * 100,
                  95
                )
                setProgress(estimatedProgress)

                if (onProgress) {
                  onProgress(content, accumulatedResponse)
                }

                yield content
              }

              if (data?.done || data?.finishReason === 'stop') {
                break
              }
            } catch {
              // Skip invalid JSON chunks
            }
          }
        }

        setProgress(100)

        if (onComplete) {
          onComplete(accumulatedResponse)
        }

        return accumulatedResponse
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? (err as Error)?.message || String(err) : 'Failed to generate streaming response'
        setError(errorMessage)

        if (onError && err instanceof Error) {
          onError(err)
        }
        return ''
      } finally {
        setIsLoading(false)
        setIsStreaming(false)
      }
    },
    [
      isLoading,
      streamingEnabled,
      model,
      temperature,
      maxTokens,
      responseType,
      systemPrompt,
      onError,
      onComplete,
      onProgress,
      makeRequest,
    ]
  )

  // Regenerate the last response
  const regenerateLastResponse = useCallback(async (): Promise<string | null> => {
    if (!lastRequestRef.current) {
      setError('No previous request to regenerate')
      return null
    }

    const lastRequest = lastRequestRef.current
    
    if (lastRequest.stream) {
      // For streaming requests, we need to handle differently
      const generator = generateStreamingResponse(lastRequest.prompt, lastRequest.context)
      let finalResponse = ''
      
      if (generator) {
        for await (const chunk of generator) {
          finalResponse += chunk
        }
      }
      
      return finalResponse
    } else {
      return generateResponse(lastRequest.prompt, lastRequest.context)
    }
  }, [generateResponse, generateStreamingResponse])

  return {
    response,
    isLoading,
    isStreaming,
    error,
    progress,
    therapeuticInsights,
    generateResponse,
    generateTherapeuticResponse,
    generateStreamingResponse,
    regenerateLastResponse,
    stopGeneration,
    reset,
  }
}
