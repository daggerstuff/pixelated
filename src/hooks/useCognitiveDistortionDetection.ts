import { useCallback, useState } from 'react'
import type {
  CognitiveDistortion,
  CognitiveDistortionResult,
  CognitiveDistortionType,
} from '../lib/ai/types/CognitiveDistortions'
import { cognitiveDistortionConfigs } from '../lib/ai/types/CognitiveDistortions'

interface UseCognitiveDistortionDetectionOptions {
  apiEndpoint?: string
  model?: string
  minConfidence?: number
  onError?: (error: Error) => void
  onDetection?: (result: CognitiveDistortionResult) => void
  onComplete?: (result: CognitiveDistortionResult) => void
}

interface UseCognitiveDistortionDetectionResult {
  result: CognitiveDistortionResult | null
  isLoading: boolean
  error: string | null
  detectDistortions: (text: string) => Promise<CognitiveDistortionResult | null>
  detectBatch: (texts: string[]) => Promise<CognitiveDistortionResult[] | null>
  reset: () => void
  // For client-side detection without API
  clientSideDetect: (text: string) => CognitiveDistortionResult
}

/**
 * Hook for detecting cognitive distortions in text
 */
export function useCognitiveDistortionDetection({
  apiEndpoint = '/api/ai/cognitive-distortions',
  model = 'gpt-4o',
  minConfidence = 0.6,
  onError,
  onDetection,
  onComplete,
}: UseCognitiveDistortionDetectionOptions = {}): UseCognitiveDistortionDetectionResult {
  const [result, setResult] = useState<CognitiveDistortionResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state
  const reset = useCallback(() => {
    setResult(null)
    setIsLoading(false)
    setError(null)
  }, [])

  // Client-side distortion detection using pattern matching
  // This is less accurate but works without an API call
  const clientSideDetect = useCallback(
    (text: string): CognitiveDistortionResult => {
      const distortions: CognitiveDistortion[] = []
      let overallNegativeThinking = 0

      // Check each distortion type
      Object.values(cognitiveDistortionConfigs).forEach((config) => {
        // Check if any patterns match
        const matchingPatterns = config.patterns.filter((pattern) =>
          pattern.test(text),
        )

        if (matchingPatterns.length > 0) {
          // Calculate confidence based on number of matched patterns
          const confidence = Math.min(
            0.5 + (matchingPatterns.length / config.patterns.length) * 0.5,
            0.95,
          )

          // Only include if above minimum confidence
          if (confidence >= minConfidence) {
            // Extract evidence (the matching text)
            let evidence = ''
            for (const pattern of matchingPatterns) {
              const match = text.match(pattern)
              if (match && match[0]) {
                evidence = match[0]
                break
              }
            }

            // Add to detected distortions
            distortions.push({
              type: config.type,
              evidence: evidence || text,
              confidence,
            })

            // Increase negative thinking score
            overallNegativeThinking += confidence * 0.1
          }
        }
      })

      // Cap overall negative thinking at 1.0
      overallNegativeThinking = Math.min(overallNegativeThinking, 1.0)

      // Create result
      const result: CognitiveDistortionResult = {
        distortions,
        overallNegativeThinking,
        summary: generateSummary(distortions, overallNegativeThinking),
        timestamp: Date.now(),
      }

      // Update state
      setResult(result)

      // Call callbacks
      if (distortions.length > 0 && onDetection) {
        onDetection(result)
      }

      if (onComplete) {
        onComplete(result)
      }

      return result
    },
    [minConfidence, onDetection, onComplete, generateSummary],
  )

  // Helper function to generate a summary
  const generateSummary = useCallback(
    (
      distortions: CognitiveDistortion[],
      overallNegativeThinking: number,
    ): string => {
      if (distortions.length === 0) {
        return 'No cognitive distortions detected.'
      }

      // Get the top distortions by confidence
      const topDistortions = [...distortions]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3)

      const distortionList = topDistortions
        .map((d) => {
          const config =
            cognitiveDistortionConfigs[d.type as CognitiveDistortionType]
          return config ? config.name : d.type
        })
        .join(', ')

      const severityLevel =
        overallNegativeThinking < 0.3
          ? 'mild'
          : overallNegativeThinking < 0.6
            ? 'moderate'
            : 'significant'

      return `Detected ${severityLevel} presence of negative thinking patterns, primarily ${distortionList}.`
    },
    [],
  )

  // Server-side detection using API
  const detectDistortions = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) {
        return null
      }

      setIsLoading(true)
      setError(null)

      try {
        // If API endpoint is not provided, use client-side detection
        if (!apiEndpoint || apiEndpoint === 'client') {
          const clientResult = clientSideDetect(text)
          setIsLoading(false)
          return clientResult
        }

        // Prepare request body
        const requestBody = {
          text,
          model,
          minConfidence,
        }

        // Send request to API
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(
            errorData.error || 'Failed to detect cognitive distortions',
          )
        }

        // Parse response
        const data = (await response.json()) as CognitiveDistortionResult
        setResult(data)

        // Call onDetection callback if distortions detected
        if (data?.distortions.length > 0 && onDetection) {
          onDetection(data)
        }

        // Call onComplete callback
        if (onComplete) {
          onComplete(data)
        }

        return data
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? (err as Error)?.message || String(err) : 'An unknown error occurred'
        setError(errorMessage)

        // Call onError callback
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
      minConfidence,
      apiEndpoint,
      onError,
      onDetection,
      onComplete,
      clientSideDetect,
    ],
  )

  // Batch detection
  const detectBatch = useCallback(
    async (texts: string[]) => {
      if (texts.length === 0 || isLoading) {
        return null
      }

      setIsLoading(true)
      setError(null)

      try {
        // If API endpoint is not provided, use client-side detection for each text
        if (!apiEndpoint || apiEndpoint === 'client') {
          const results = texts.map((text) => clientSideDetect(text))
          setIsLoading(false)
          return results
        }

        // Prepare request body
        const requestBody = {
          batch: texts,
          model,
          minConfidence,
        }

        // Send request to API
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(
            errorData.error ||
              'Failed to detect cognitive distortions in batch',
          )
        }

        // Parse response
        const data = (await response.json()) as CognitiveDistortionResult[]

        // We don't set result for batch analysis since it's multiple results
        // But we can call callbacks with the first result if needed
        if (onComplete && data?.length > 0) {
          onComplete(data[0])
        }

        return data
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? (err as Error)?.message || String(err) : 'An unknown error occurred'
        setError(errorMessage)

        // Call onError callback
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
      minConfidence,
      apiEndpoint,
      onError,
      onComplete,
      clientSideDetect,
    ],
  )

  return {
    result,
    isLoading,
    error,
    detectDistortions,
    detectBatch,
    reset,
    clientSideDetect,
  }
}
