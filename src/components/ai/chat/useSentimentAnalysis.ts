import type { SentimentAnalysisResult } from '../../../lib/db/ai/types'
import { useCallback, useState, useRef } from 'react'

interface UseSentimentAnalysisOptions {
  apiEndpoint?: string
  model?: string
  temperature?: number
  maxRetries?: number
  timeout?: number
  confidenceThreshold?: number
  batchSize?: number
  onError?: (error: Error) => void
  onComplete?: (result: SentimentAnalysisResult) => void
  onProgress?: (current: number, total: number) => void
  onBatchComplete?: (results: SentimentAnalysisResult[], failed: number) => void
}

interface UseSentimentAnalysisResult {
  result: SentimentAnalysisResult | null
  results: SentimentAnalysisResult[]
  isLoading: boolean
  isAnalyzing: boolean
  error: string | null
  progress: number
  totalAnalyzed: number
  successCount: number
  failureCount: number
  averageConfidence: number
  analyzeText: (text: string) => Promise<SentimentAnalysisResult | null>
  analyzeBatch: (texts: string[]) => Promise<SentimentAnalysisResult[] | null>
  analyzeStream: (texts: string[]) => AsyncGenerator<SentimentAnalysisResult, SentimentAnalysisResult[], unknown>
  reanalyzeLastText: () => Promise<SentimentAnalysisResult | null>
  cancelAnalysis: () => void
  reset: () => void
  getInsights: () => SentimentInsights
}

interface SentimentInsights {
  dominantSentiment: string
  confidenceDistribution: { [key: string]: number }
  emotionalTrends: string[]
  riskFactors: string[]
  recommendations: string[]
}

/**
 * Checks if an error is retryable for sentiment analysis
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
 * Generate insights from sentiment analysis results
 */
function generateSentimentInsights(results: SentimentAnalysisResult[]): SentimentInsights {
  if (results.length === 0) {
    return {
      dominantSentiment: 'neutral',
      confidenceDistribution: {},
      emotionalTrends: [],
      riskFactors: [],
      recommendations: [],
    }
  }

  // Calculate sentiment distribution
  const sentimentCounts = results.reduce((acc, result) => {
    acc[result.sentiment] = (acc[result.sentiment] || 0) + 1
    return acc
  }, {} as { [key: string]: number })

  const dominantSentiment = Object.entries(sentimentCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'neutral'

  // Calculate confidence distribution
  const confidenceDistribution = Object.fromEntries(
    Object.entries(sentimentCounts).map(([sentiment, count]) => [
      sentiment,
      count / results.length,
    ])
  )

  // Generate emotional trends
  const emotionalTrends: string[] = []
  const negativeRatio = (sentimentCounts['negative'] ?? 0) / results.length
  const positiveRatio = (sentimentCounts['positive'] ?? 0) / results.length

  if (negativeRatio > 0.6) {
    emotionalTrends.push('Predominantly negative emotional pattern')
  }
  if (positiveRatio > 0.6) {
    emotionalTrends.push('Predominantly positive emotional pattern')
  }
  if (Math.abs(negativeRatio - positiveRatio) < 0.2) {
    emotionalTrends.push('Mixed emotional patterns')
  }

  // Identify risk factors
  const riskFactors: string[] = []
  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length

  if (negativeRatio > 0.7) {
    riskFactors.push('High negative sentiment concentration')
  }
  if (avgConfidence < 0.6) {
    riskFactors.push('Low confidence in sentiment analysis')
  }
  if (results.some(r => r.sentiment === 'negative' && r.confidence > 0.8)) {
    riskFactors.push('Strong negative sentiment detected')
  }

  // Generate recommendations
  const recommendations: string[] = []
  if (negativeRatio > 0.5) {
    recommendations.push('Consider therapeutic intervention or support')
    recommendations.push('Monitor for crisis indicators')
  }
  if (avgConfidence < 0.7) {
    recommendations.push('Consider more detailed emotional assessment')
  }
  if (emotionalTrends.includes('Mixed emotional patterns')) {
    recommendations.push('Explore underlying causes of emotional variability')
  }

  return {
    dominantSentiment,
    confidenceDistribution,
    emotionalTrends,
    riskFactors,
    recommendations,
  }
}

/**
 * Enhanced custom hook for sentiment analysis with advanced features
 */
export function useSentimentAnalysis({
  apiEndpoint = '/api/ai/sentiment',
  model = 'gpt-4o',
  temperature = 0.3,
  maxRetries = 3,
  timeout = 30000,
  confidenceThreshold = 0.5,
  batchSize = 10,
  onError,
  onComplete,
  onProgress,
  onBatchComplete,
}: UseSentimentAnalysisOptions = {}): UseSentimentAnalysisResult {
  const [result, setResult] = useState<SentimentAnalysisResult | null>(null)
  const [results, setResults] = useState<SentimentAnalysisResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<number>(0)
  const [totalAnalyzed, setTotalAnalyzed] = useState<number>(0)
  const [successCount, setSuccessCount] = useState<number>(0)
  const [failureCount, setFailureCount] = useState<number>(0)

  // Store last request for re-analysis
  const lastTextRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Calculate average confidence
  const averageConfidence = results.length > 0
    ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length
    : 0

  // Reset all state
  const reset = useCallback(() => {
    setResult(null)
    setResults([])
    setIsLoading(false)
    setIsAnalyzing(false)
    setError(null)
    setProgress(0)
    setTotalAnalyzed(0)
    setSuccessCount(0)
    setFailureCount(0)
    lastTextRef.current = null
    
    // Abort any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  // Cancel ongoing analysis
  const cancelAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsLoading(false)
    setIsAnalyzing(false)
  }, [])

  // Core function to make API request
  const makeRequest = useCallback(
    async (requestData: Record<string, unknown>): Promise<Response> => {
      // Create new abort controller for this request
      abortControllerRef.current = new AbortController()
      
      const timeoutId = setTimeout(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }
      }, timeout)

      try {
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...requestData,
            model,
            temperature,
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
    [apiEndpoint, model, temperature, timeout]
  )

  // Analyze a single text
  const analyzeText = useCallback(
    async (text: string): Promise<SentimentAnalysisResult | null> => {
      if (!text.trim() || isLoading) {
        return null
      }

      lastTextRef.current = text
      setIsLoading(true)
      setError(null)
      setProgress(0)

      let retries = 0
      while (retries < maxRetries) {
        try {
          const response = await makeRequest({ text })
          const data = await response.json() as SentimentAnalysisResult

          // Validate confidence threshold
          if (data.confidence < confidenceThreshold) {
            console.warn(`Low confidence sentiment analysis: ${data.confidence}`)
          }

          setResult(data)
          setResults(prev => [...prev, data])
          setTotalAnalyzed(prev => prev + 1)
          setSuccessCount(prev => prev + 1)
          setProgress(100)

          if (onComplete) {
            onComplete(data)
          }

          return data
        } catch (err: unknown) {
          if (retries === maxRetries - 1 || !isRetryableError(err)) {
            const errorMessage =
              err instanceof Error ? (err as Error)?.message || String(err) : 'Failed to analyze sentiment'
            setError(errorMessage)
            setFailureCount(prev => prev + 1)

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
          if (retries === maxRetries - 1) {
            setIsLoading(false)
          }
        }
      }

      return null
    },
    [isLoading, maxRetries, confidenceThreshold, onComplete, onError, makeRequest]
  )

  // Analyze a batch of texts
  const analyzeBatch = useCallback(
    async (texts: string[]): Promise<SentimentAnalysisResult[] | null> => {
      if (texts.length === 0 || isLoading) {
        return null
      }

      setIsLoading(true)
      setIsAnalyzing(true)
      setError(null)
      setProgress(0)

      const batchResults: SentimentAnalysisResult[] = []
      const failedCount = 0

      try {
        // Process in chunks
        for (let i = 0; i < texts.length; i += batchSize) {
          const chunk = texts.slice(i, i + batchSize)
          
          const response = await makeRequest({ batch: chunk })
          const chunkResults = await response.json() as SentimentAnalysisResult[]

          batchResults.push(...chunkResults)
          setResults(prev => [...prev, ...chunkResults])
          setSuccessCount(prev => prev + chunkResults.length)

          // Update progress
          const currentProgress = Math.min(((i + chunk.length) / texts.length) * 100, 100)
          setProgress(currentProgress)

          if (onProgress) {
            onProgress(i + chunk.length, texts.length)
          }
        }

        setTotalAnalyzed(prev => prev + batchResults.length)

        if (onBatchComplete) {
          onBatchComplete(batchResults, failedCount)
        }

        return batchResults
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? (err as Error)?.message || String(err) : 'Failed to analyze sentiment batch'
        setError(errorMessage)
        setFailureCount(prev => prev + texts.length - batchResults.length)

        if (onError && err instanceof Error) {
          onError(err)
        }
        return null
      } finally {
        setIsLoading(false)
        setIsAnalyzing(false)
      }
    },
    [isLoading, batchSize, onProgress, onBatchComplete, onError, makeRequest]
  )

  // Analyze texts as a stream
  const analyzeStream = useCallback(
    async function* (
      texts: string[]
    ): AsyncGenerator<SentimentAnalysisResult, SentimentAnalysisResult[], unknown> {
      if (texts.length === 0 || isLoading) {
        return []
      }

      setIsLoading(true)
      setIsAnalyzing(true)
      setError(null)
      setProgress(0)

      const streamResults: SentimentAnalysisResult[] = []

      try {
        for (let i = 0; i < texts.length; i++) {
          const text = texts[i]
          
          try {
            const response = await makeRequest({ text })
            const data = await response.json() as SentimentAnalysisResult

            streamResults.push(data)
            setResults(prev => [...prev, data])
            setSuccessCount(prev => prev + 1)

            // Update progress
            const currentProgress = ((i + 1) / texts.length) * 100
            setProgress(currentProgress)

            if (onProgress) {
              onProgress(i + 1, texts.length)
            }

            yield data
          } catch (err: unknown) {
            setFailureCount(prev => prev + 1)
            console.warn(`Failed to analyze text ${i + 1}:`, err)
          }
        }

        setTotalAnalyzed(prev => prev + streamResults.length)
        return streamResults
      } finally {
        setIsLoading(false)
        setIsAnalyzing(false)
      }
    },
    [isLoading, onProgress, makeRequest]
  )

  // Re-analyze the last text
  const reanalyzeLastText = useCallback(async (): Promise<SentimentAnalysisResult | null> => {
    if (!lastTextRef.current) {
      setError('No previous text to re-analyze')
      return null
    }

    return analyzeText(lastTextRef.current)
  }, [analyzeText])

  // Generate insights from current results
  const getInsights = useCallback((): SentimentInsights => {
    return generateSentimentInsights(results)
  }, [results])

  return {
    result,
    results,
    isLoading,
    isAnalyzing,
    error,
    progress,
    totalAnalyzed,
    successCount,
    failureCount,
    averageConfidence,
    analyzeText,
    analyzeBatch,
    analyzeStream,
    reanalyzeLastText,
    cancelAnalysis,
    reset,
    getInsights,
  }
}
