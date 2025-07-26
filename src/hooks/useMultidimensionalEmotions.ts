import { useState, useEffect, useRef, useCallback } from 'react'

export interface EmotionData {
  timestamp: number
  valence: number // Pleasure dimension (0-1)
  arousal: number // Arousal dimension (0-1)
  dominance: number // Dominance dimension (0-1)
  emotion?: string // Named emotion (optional)
}

type TimeRange = 'day' | 'week' | 'month' | 'year'

interface UseMultidimensionalEmotionsReturn {
  data: EmotionData[]
  isLoading: boolean
  error: Error | null
  refresh: () => void
  isCached: boolean // Added to indicate if data was loaded from cache
}

interface EmotionApiResponse {
  data: {
    timestamp: number
    dimensions: {
      valence: number
      arousal: number
      dominance: number
    }
    mappedEmotion?: string
  }[]
  meta: {
    totalCount: number
    pageCount: number
    hasMore: boolean
  }
}

interface CacheEntry {
  data: EmotionData[]
  timestamp: number
  size: number // Approximate memory size in bytes
  lastAccessed: number // Last access timestamp
  priority: number // Priority level for cache retention policy
}

// Improved cache implementation
class EmotionDataCache {
  private cache = new Map<string, CacheEntry>()
  private maxEntries = 20 // Maximum number of cache entries
  private maxMemory = 10 * 1024 * 1024 // Max cache size (10MB)
  private currentMemory = 0
  private ttl = 5 * 60 * 1000 // Default TTL: 5 minutes
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Set up periodic cache cleanup
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000)
  }

  // Calculate approximate size of emotion data in bytes
  private calculateSize(data: EmotionData[]): number {
    // Each emotion data point has 4 numbers (timestamp, valence, arousal, dominance)
    // Each number is approximately 8 bytes + possible emotion string (est. 20 bytes)
    // Plus overhead for object structure
    const bytesPerEntry = 4 * 8 + (data[0]?.emotion ? 20 : 0) + 16
    return data.length * bytesPerEntry
  }

  // Get data from cache
  get(key: string): EmotionData[] | null {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check if entry has expired
    const now = Date.now()
    if (now - entry.timestamp > this.ttl) {
      this.delete(key)
      return null
    }

    // Update last accessed time and increase priority
    entry.lastAccessed = now
    entry.priority += 1

    return entry.data
  }

  // Set data in cache
  set(key: string, data: EmotionData[], priority = 1): void {
    // Calculate size of the new data
    const size = this.calculateSize(data)

    // If the new data is too large for our cache, don't cache it
    if (size > this.maxMemory * 0.5) {
      console.warn(`Data too large for cache: ${size} bytes`)
      return
    }

    // If adding this would exceed our memory limit, make room
    if (this.currentMemory + size > this.maxMemory) {
      this.evict(size)
    }

    // If we have too many entries, remove the least valuable one
    if (this.cache.size >= this.maxEntries) {
      this.evictLeastValuable()
    }

    // Add the new entry
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      size,
      lastAccessed: Date.now(),
      priority,
    })

    this.currentMemory += size
  }

  // Delete a specific entry
  delete(key: string): void {
    const entry = this.cache.get(key)
    if (entry) {
      this.currentMemory -= entry.size
      this.cache.delete(key)
    }
  }

  // Clear all entries
  clear(): void {
    this.cache.clear()
    this.currentMemory = 0
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.delete(key)
      }
    }
  }

  // Evict entries to make room for new data
  private evict(requiredSpace: number): void {
    // Sort entries by priority and last accessed time
    const entries = Array.from(this.cache.entries()).sort((a, b) => {
      // First by priority (lowest first)
      const priorityDiff = a[1].priority - b[1].priority
      if (priorityDiff !== 0) {
        return priorityDiff
      }

      // Then by last accessed (oldest first)
      return a[1].lastAccessed - b[1].lastAccessed
    })

    // Remove entries until we have enough space
    let freedSpace = 0
    for (const [key, entry] of entries) {
      this.delete(key)
      freedSpace += entry.size

      if (freedSpace >= requiredSpace) {
        break
      }
    }
  }

  // Remove the least valuable entry based on priority and access time
  private evictLeastValuable(): void {
    let leastValuableKey: string | null = null
    let lowestValue = Infinity

    for (const [key, entry] of this.cache.entries()) {
      // Calculate value based on priority and recency
      const recencyFactor = Math.max(
        1,
        (Date.now() - entry.lastAccessed) / 1000,
      )
      const value = entry.priority / recencyFactor

      if (value < lowestValue) {
        lowestValue = value
        leastValuableKey = key
      }
    }

    if (leastValuableKey) {
      this.delete(leastValuableKey)
    }
  }

  // Clean up when the object is garbage collected
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  // Set custom TTL for specific client data
  setTTL(clientId: string, ttl: number): void {
    // In a more advanced implementation, we could have client-specific TTLs
    this.ttl = ttl
  }

  // Get cache statistics for monitoring
  getStats(): {
    entries: number
    memoryUsed: number
    memoryLimit: number
  } {
    return {
      entries: this.cache.size,
      memoryUsed: this.currentMemory,
      memoryLimit: this.maxMemory,
    }
  }
}

// Singleton cache instance
const emotionCache = new EmotionDataCache()

// Clean up cache when window is unloaded
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    emotionCache.destroy()
  })
}

/**
 * A hook to fetch and manage multidimensional emotion data based on the PAD model.
 *
 * @param clientId The client ID to fetch data for
 * @param timeRange The time range to fetch data for
 * @param dataPoints The number of data points to fetch
 * @returns Object containing emotion data, loading state, error, and refresh function
 */
export function useMultidimensionalEmotions(
  clientId: string,
  timeRange: TimeRange = 'week',
  dataPoints: number = 100,
): UseMultidimensionalEmotionsReturn {
  const [data, setData] = useState<EmotionData[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)
  const [isCached, setIsCached] = useState<boolean>(false)

  // Use refs to track the current request and prevent race conditions
  const abortControllerRef = useRef<AbortController | null>(null)
  const isMountedRef = useRef(true)

  // Helper to convert time range to milliseconds
  const getTimeRangeInMs = (range: TimeRange): number => {
    const timeRanges = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
    }
    return timeRanges[range]
  }

  // Create a fetch function that we can call from outside the effect
  const fetchEmotionData = useCallback(
    async (ignoreCache = false) => {
      if (!clientId) {
        setError(new Error('Client ID is required'))
        setIsLoading(false)
        return
      }

      // Cancel any existing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController()

      setIsLoading(true)
      setError(null)
      setIsCached(false)

      // Calculate cache key
      const cacheKey = `emotions_${clientId}_${timeRange}_${dataPoints}`

      // Check cache first unless explicitly told to ignore it
      if (!ignoreCache) {
        const cachedData = emotionCache.get(cacheKey)
        if (cachedData) {
          setData(cachedData)
          setIsLoading(false)
          setIsCached(true)
          return
        }
      }

      try {
        // Progressive loading implementation
        // 1. First, display a lower resolution version from cache if available
        const lowResKey = `emotions_${clientId}_${timeRange}_${Math.floor(dataPoints / 4)}`
        const lowResData = emotionCache.get(lowResKey)

        if (lowResData && !ignoreCache) {
          // Show low-resolution data while loading full data
          setData(lowResData)
          setIsCached(true)
          // Continue loading but don't set isLoading to false yet
        }

        const startDate = new Date(Date.now() - getTimeRangeInMs(timeRange))
        const endDate = new Date()

        // Build query parameters
        const params = new URLSearchParams({
          clientId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          limit: dataPoints.toString(),
        })

        // Fetch data from API with pagination support
        const response = await fetch(`/api/emotions/dimensional?${params}`, {
          signal: abortControllerRef.current.signal,
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error(`Error fetching emotion data: ${response.statusText}`)
        }

        const result: EmotionApiResponse = await response.json()

        // Transform API response to our format
        const emotionData: EmotionData[] = result.data.map((item) => ({
          timestamp: item.timestamp,
          valence: item.dimensions.valence,
          arousal: item.dimensions.arousal,
          dominance: item.dimensions.dominance,
          emotion: item.mappedEmotion,
        }))

        // Sort by timestamp (oldest first)
        emotionData.sort((a, b) => a.timestamp - b.timestamp)

        // Only update state if the component is still mounted
        if (isMountedRef.current) {
          setData(emotionData)
          setIsCached(false)

          // Cache the results with different priorities based on time range
          let priority = 1
          switch (timeRange) {
            case 'day':
              priority = 4 // Most recent data, highest priority
              break
            case 'week':
              priority = 3
              break
            case 'month':
              priority = 2
              break
            case 'year':
              priority = 1 // Oldest data, lowest priority
              break
          }

          emotionCache.set(cacheKey, emotionData, priority)

          // Also cache smaller versions for progressive loading
          if (dataPoints > 20) {
            const sampledData = sampleData(
              emotionData,
              Math.floor(dataPoints / 4),
            )
            emotionCache.set(lowResKey, sampledData, priority - 1)
          }
        }
      } catch (err) {
        // Only update state if the component is still mounted and it's not an abort error
        if (
          isMountedRef.current &&
          !(err instanceof DOMException && err.name === 'AbortError')
        ) {
          console.error('Error fetching emotion data:', err)
          setError(err instanceof Error ? err : new Error(String(err)))
          setIsCached(false)
        }
      } finally {
        // Only update state if the component is still mounted
        if (isMountedRef.current) {
          setIsLoading(false)
        }
      }
    },
    [clientId, timeRange, dataPoints],
  )

  useEffect(() => {
    // Initialize mounted ref
    isMountedRef.current = true

    // Set appropriate TTL based on time range
    // Recent data changes more frequently than historical data
    switch (timeRange) {
      case 'day':
        emotionCache.setTTL(clientId, 2 * 60 * 1000) // 2 minutes
        break
      case 'week':
        emotionCache.setTTL(clientId, 5 * 60 * 1000) // 5 minutes
        break
      case 'month':
        emotionCache.setTTL(clientId, 15 * 60 * 1000) // 15 minutes
        break
      case 'year':
        emotionCache.setTTL(clientId, 60 * 60 * 1000) // 1 hour
        break
    }

    // Fetch data
    fetchEmotionData()

    // Clean up function
    return () => {
      isMountedRef.current = false

      // Cancel any pending requests when the component unmounts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchEmotionData, timeRange, clientId])

  // Create a refresh function to manually refetch data
  const refresh = useCallback(() => {
    // Force refetch bypassing cache
    fetchEmotionData(true)
  }, [fetchEmotionData])

  return { data, isLoading, error, refresh, isCached }
}

// Helper to sample data for lower resolution preview
function sampleData(data: EmotionData[], targetCount: number): EmotionData[] {
  if (data.length <= targetCount) {
    return data
  }

  const result: EmotionData[] = []
  const stride = data.length / targetCount

  for (let i = 0; i < targetCount; i++) {
    const index = Math.min(Math.floor(i * stride), data.length - 1)
    result.push(data[index])
  }

  return result
}

export default useMultidimensionalEmotions
