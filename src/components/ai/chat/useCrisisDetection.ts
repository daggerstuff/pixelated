import type { CrisisDetectionResult } from '../../../lib/ai/crisis/types'
import { useCallback, useState, useRef } from 'react'
import crypto from 'crypto'

interface UseCrisisDetectionOptions {
  apiEndpoint?: string
  model?: string
  temperature?: number
  maxRetries?: number
  timeout?: number
  sensitivityLevel?: 'low' | 'medium' | 'high'
  alertThreshold?: number
  batchSize?: number
  realTimeMode?: boolean
  onError?: (error: Error) => void
  onCrisisDetected?: (result: CrisisDetectionResult) => void
  onComplete?: (result: CrisisDetectionResult) => void
  onProgress?: (current: number, total: number) => void
  onAlert?: (alerts: CrisisAlert[]) => void
}

interface UseCrisisDetectionResult {
  result: CrisisDetectionResult | null
  results: CrisisDetectionResult[]
  isLoading: boolean
  isMonitoring: boolean
  error: string | null
  progress: number
  totalDetected: number
  crisisCount: number
  highRiskCount: number
  averageRiskLevel: number
  alerts: CrisisAlert[]
  detectCrisis: (text: string) => Promise<CrisisDetectionResult | null>
  detectBatch: (texts: string[]) => Promise<CrisisDetectionResult[] | null>
  monitorStream: (texts: string[]) => AsyncGenerator<CrisisDetectionResult, CrisisDetectionResult[], unknown>
  redetectLastText: () => Promise<CrisisDetectionResult | null>
  startRealTimeMonitoring: () => void
  stopRealTimeMonitoring: () => void
  cancelDetection: () => void
  clearAlerts: () => void
  reset: () => void
  getAnalytics: () => CrisisAnalytics
}

interface CrisisAlert {
  id: string
  timestamp: Date
  level: 'warning' | 'danger' | 'critical'
  message: string
  result: CrisisDetectionResult
  acknowledged: boolean
}

interface CrisisAnalytics {
  riskDistribution: { [key: string]: number }
  crisisTypes: { [key: string]: number }
  temporalPatterns: string[]
  recommendations: string[]
  interventionSuggestions: string[]
}

/**
 * Checks if an error is retryable for crisis detection
 */
function isRetryableError(error: unknown): boolean {
  // Network errors are retryable
  if (error instanceof TypeError && error.message.includes('network')) {
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
 * Generate crisis analytics from detection results
 */
function generateCrisisAnalytics(results: CrisisDetectionResult[]): CrisisAnalytics {
  if (results.length === 0) {
    return {
      riskDistribution: {},
      crisisTypes: {},
      temporalPatterns: [],
      recommendations: [],
      interventionSuggestions: [],
    }
  }

  // Calculate risk distribution
  const riskCounts = results.reduce((acc, result) => {
    acc[result.riskLevel] = (acc[result.riskLevel] || 0) + 1
    return acc
  }, {} as { [key: string]: number })

  const riskDistribution = Object.fromEntries(
    Object.entries(riskCounts).map(([risk, count]) => [risk, count / results.length])
  )

  // Calculate crisis types
  const crisisTypes = results
    .filter(r => r.isCrisis && r.category)
    .reduce((acc, result) => {
      const type = result.category!
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as { [key: string]: number })

  // Generate temporal patterns
  const temporalPatterns: string[] = []
  const crisisRatio = results.filter(r => r.isCrisis).length / results.length
  const highRiskRatio = results.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').length / results.length

  if (crisisRatio > 0.3) {
    temporalPatterns.push('High frequency of crisis indicators')
  }
  if (highRiskRatio > 0.2) {
    temporalPatterns.push('Elevated risk pattern detected')
  }

  // Generate recommendations
  const recommendations: string[] = []
  if (crisisRatio > 0.1) {
    recommendations.push('Implement immediate monitoring protocols')
    recommendations.push('Consider professional intervention')
  }
  if (highRiskRatio > 0.15) {
    recommendations.push('Escalate to crisis response team')
  }

  // Generate intervention suggestions
  const interventionSuggestions: string[] = []
  if (Object.keys(crisisTypes).includes('self-harm')) {
    interventionSuggestions.push('Suicide prevention protocol activation')
  }
  if (Object.keys(crisisTypes).includes('substance-abuse')) {
    interventionSuggestions.push('Substance abuse counseling referral')
  }
  if (crisisRatio > 0.2) {
    interventionSuggestions.push('Emergency mental health evaluation')
  }

  return {
    riskDistribution,
    crisisTypes,
    temporalPatterns,
    recommendations,
    interventionSuggestions,
  }
}

/**
 * Enhanced custom hook for crisis detection with advanced monitoring features
 */
export function useCrisisDetection({
  apiEndpoint = '/api/ai/crisis-detection',
  model = 'gpt-4o',
  temperature = 0.2,
  maxRetries = 3,
  timeout = 30000,
  sensitivityLevel = 'medium',
  alertThreshold = 0.7,
  batchSize = 5,
  realTimeMode = false,
  onError,
  onCrisisDetected,
  onComplete,
  onProgress,
  onAlert,
}: UseCrisisDetectionOptions = {}): UseCrisisDetectionResult {
  const [result, setResult] = useState<CrisisDetectionResult | null>(null)
  const [results, setResults] = useState<CrisisDetectionResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<number>(0)
  const [totalDetected, setTotalDetected] = useState<number>(0)
  const [alerts, setAlerts] = useState<CrisisAlert[]>([])

  // Store last request for re-detection
  const lastTextRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Calculate metrics
  const crisisCount = results.filter(r => r.isCrisis).length
  const highRiskCount = results.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').length
  
  const averageRiskLevel = results.length > 0
    ? results.reduce((sum, r) => {
        const riskValues = { low: 1, medium: 2, high: 3, critical: 4 }
        return sum + riskValues[r.riskLevel]
      }, 0) / results.length
    : 0

  // Reset all state
  const reset = useCallback(() => {
    setResult(null)
    setResults([])
    setIsLoading(false)
    setIsMonitoring(false)
    setError(null)
    setProgress(0)
    setTotalDetected(0)
    setAlerts([])
    lastTextRef.current = null
    
    // Abort any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // Clear monitoring interval
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current)
      monitoringIntervalRef.current = null
    }
  }, [])

  // Cancel ongoing detection
  const cancelDetection = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsLoading(false)
    setIsMonitoring(false)
  }, [])

  // Clear alerts
  const clearAlerts = useCallback(() => {
    setAlerts([])
  }, [])

  // Create crisis alert
  const createAlert = useCallback((result: CrisisDetectionResult): CrisisAlert => {
    let level: 'warning' | 'danger' | 'critical' = 'warning'
    let message = 'Crisis indicator detected'

    if (result.riskLevel === 'critical') {
      level = 'critical'
      message = 'CRITICAL: Immediate intervention required'
    } else if (result.riskLevel === 'high') {
      level = 'danger'
      message = 'HIGH RISK: Crisis detected, urgent attention needed'
    } else if (result.isCrisis) {
      level = 'warning'
      message = 'Crisis indicator detected, monitoring recommended'
    }

    return {
      id: `alert-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`,
      timestamp: new Date(),
      level,
      message,
      result,
      acknowledged: false,
    }
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
            sensitivityLevel,
          }),
          signal: abortControllerRef.current.signal,
        })

        clearTimeout(timeoutId)
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `API request failed: ${response.status}`)
        }

        return response
      } catch (err) {
        clearTimeout(timeoutId)
        throw err
      }
    },
    [apiEndpoint, model, temperature, sensitivityLevel, timeout]
  )

  // Detect crisis in a single text
  const detectCrisis = useCallback(
    async (text: string): Promise<CrisisDetectionResult | null> => {
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
          const data = await response.json() as CrisisDetectionResult

          setResult(data)
          setResults(prev => [...prev, data])
          setTotalDetected(prev => prev + 1)
          setProgress(100)

          // Handle crisis detection
          if (data.isCrisis && onCrisisDetected) {
            onCrisisDetected(data)
          }

          // Create alert if threshold exceeded
          if (data.confidence >= alertThreshold || data.riskLevel === 'high' || data.riskLevel === 'critical') {
            const alert = createAlert(data)
            setAlerts(prev => [...prev, alert])
            
            if (onAlert) {
              onAlert([alert])
            }
          }

          if (onComplete) {
            onComplete(data)
          }

          return data
        } catch (err) {
          if (retries === maxRetries - 1 || !isRetryableError(err)) {
            const errorMessage =
              err instanceof Error ? err.message : 'Failed to detect crisis'
            setError(errorMessage)

            if (onError && err instanceof Error) {
              onError(err)
            }
            return null
          }

          retries++
          // Exponential backoff with jitter
          const secureJitter = parseInt(crypto.randomBytes(2).toString('hex'), 16) % 1000
          const delay = Math.min(1000 * Math.pow(2, retries) + secureJitter, 10000)
          await new Promise((resolve) => setTimeout(resolve, delay))
        } finally {
          if (retries === maxRetries - 1) {
            setIsLoading(false)
          }
        }
      }

      return null
    },
    [isLoading, maxRetries, alertThreshold, createAlert, onCrisisDetected, onComplete, onAlert, onError, makeRequest]
  )

  // Detect crisis in a batch of texts
  const detectBatch = useCallback(
    async (texts: string[]): Promise<CrisisDetectionResult[] | null> => {
      if (texts.length === 0 || isLoading) {
        return null
      }

      setIsLoading(true)
      setIsMonitoring(true)
      setError(null)
      setProgress(0)

      const batchResults: CrisisDetectionResult[] = []
      const newAlerts: CrisisAlert[] = []

      try {
        // Process in chunks
        for (let i = 0; i < texts.length; i += batchSize) {
          const chunk = texts.slice(i, i + batchSize)
          
          const response = await makeRequest({ batch: chunk })
          const chunkResults = await response.json() as CrisisDetectionResult[]

          batchResults.push(...chunkResults)
          setResults(prev => [...prev, ...chunkResults])

          // Process alerts
          chunkResults.forEach(result => {
            if (result.isCrisis && onCrisisDetected) {
              onCrisisDetected(result)
            }

            if (result.confidence >= alertThreshold || result.riskLevel === 'high' || result.riskLevel === 'critical') {
              const alert = createAlert(result)
              newAlerts.push(alert)
            }
          })

          // Update progress
          const currentProgress = Math.min(((i + chunk.length) / texts.length) * 100, 100)
          setProgress(currentProgress)

          if (onProgress) {
            onProgress(i + chunk.length, texts.length)
          }
        }

        setTotalDetected(prev => prev + batchResults.length)
        
        if (newAlerts.length > 0) {
          setAlerts(prev => [...prev, ...newAlerts])
          if (onAlert) {
            onAlert(newAlerts)
          }
        }

        return batchResults
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to detect crisis in batch'
        setError(errorMessage)

        if (onError && err instanceof Error) {
          onError(err)
        }
        return null
      } finally {
        setIsLoading(false)
        setIsMonitoring(false)
      }
    },
    [isLoading, batchSize, alertThreshold, createAlert, onProgress, onCrisisDetected, onAlert, onError, makeRequest]
  )

  // Monitor texts as a stream
  const monitorStream = useCallback(
    async function* (
      texts: string[]
    ): AsyncGenerator<CrisisDetectionResult, CrisisDetectionResult[], unknown> {
      if (texts.length === 0 || isLoading) {
        return []
      }

      setIsLoading(true)
      setIsMonitoring(true)
      setError(null)
      setProgress(0)

      const streamResults: CrisisDetectionResult[] = []
      const newAlerts: CrisisAlert[] = []

      try {
        for (let i = 0; i < texts.length; i++) {
          const text = texts[i]
          
          try {
            const response = await makeRequest({ text })
            const data = await response.json() as CrisisDetectionResult

            streamResults.push(data)
            setResults(prev => [...prev, data])

            // Handle crisis detection
            if (data.isCrisis && onCrisisDetected) {
              onCrisisDetected(data)
            }

            // Create alert if threshold exceeded
            if (data.confidence >= alertThreshold || data.riskLevel === 'high' || data.riskLevel === 'critical') {
              const alert = createAlert(data)
              newAlerts.push(alert)
              setAlerts(prev => [...prev, alert])
            }

            // Update progress
            const currentProgress = ((i + 1) / texts.length) * 100
            setProgress(currentProgress)

            if (onProgress) {
              onProgress(i + 1, texts.length)
            }

            yield data
          } catch (err) {
            console.warn(`Failed to detect crisis in text ${i + 1}:`, err)
          }
        }

        setTotalDetected(prev => prev + streamResults.length)
        
        if (newAlerts.length > 0 && onAlert) {
          onAlert(newAlerts)
        }

        return streamResults
      } finally {
        setIsLoading(false)
        setIsMonitoring(false)
      }
    },
    [isLoading, alertThreshold, createAlert, onProgress, onCrisisDetected, onAlert, makeRequest]
  )

  // Re-detect the last text
  const redetectLastText = useCallback(async (): Promise<CrisisDetectionResult | null> => {
    if (!lastTextRef.current) {
      setError('No previous text to re-detect')
      return null
    }

    return detectCrisis(lastTextRef.current)
  }, [detectCrisis])

  // Start real-time monitoring
  const startRealTimeMonitoring = useCallback(() => {
    if (!realTimeMode) {
      console.warn('Real-time monitoring requires realTimeMode to be enabled')
      return
    }

    setIsMonitoring(true)
    
    // This would typically connect to a real-time data source
    // For now, we'll just set the monitoring state
    console.log('Real-time crisis monitoring started')
  }, [realTimeMode])

  // Stop real-time monitoring
  const stopRealTimeMonitoring = useCallback(() => {
    setIsMonitoring(false)
    
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current)
      monitoringIntervalRef.current = null
    }
    
    console.log('Real-time crisis monitoring stopped')
  }, [])

  // Generate analytics from current results
  const getAnalytics = useCallback((): CrisisAnalytics => {
    return generateCrisisAnalytics(results)
  }, [results])

  return {
    result,
    results,
    isLoading,
    isMonitoring,
    error,
    progress,
    totalDetected,
    crisisCount,
    highRiskCount,
    averageRiskLevel,
    alerts,
    detectCrisis,
    detectBatch,
    monitorStream,
    redetectLastText,
    startRealTimeMonitoring,
    stopRealTimeMonitoring,
    cancelDetection,
    clearAlerts,
    reset,
    getAnalytics,
  }
}
