import type { APIRoute } from 'astro'
import { getEmotionsRepository } from '../../../lib/repositories/emotionsRepository'
import { protectApi } from '../../../lib/auth/apiAuth'
import { getCacheService } from '../../../lib/services/cacheService'
import type { DimensionalEmotionMap } from '../../../lib/ai/emotions/dimensionalTypes'

// Disable prerendering since this API route uses request.headers
export const prerender = false

/**
 * API endpoint for fetching dimensional emotion data with caching optimization.
 * Implements:
 * - Redis-based server cache to reduce database load
 * - ETag support for client caching
 * - Variable TTL based on time range
 * - Conditional requests with If-None-Match
 */
export const GET: APIRoute = async ({ request }) => {
  try {
    // Protect the API endpoint
    const authResult = await protectApi(request)
    if (!authResult.success) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }

    // Extract query parameters
    const url = new URL(request.url)
    const clientId = url.searchParams.get('clientId')
    const startDateStr = url.searchParams.get('startDate')
    const endDateStr = url.searchParams.get('endDate')
    const limitStr = url.searchParams.get('limit')

    // Validate parameters
    if (!clientId) {
      return new Response(JSON.stringify({ error: 'Client ID is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }

    // Parse dates and limits
    const startDate = startDateStr ? new Date(startDateStr) : undefined
    const endDate = endDateStr ? new Date(endDateStr) : undefined
    const limit = limitStr ? parseInt(limitStr, 10) : 100

    // Get cache service
    const cacheService = getCacheService()
    const cacheKey = `emotions:dimensional:${clientId}:${startDateStr || 'none'}:${endDateStr || 'none'}:${limit}`

    // Generate ETag from cache key
    const etag = `"${hashString(cacheKey)}"`

    // Check for If-None-Match header for conditional requests
    const ifNoneMatch = request.headers.get('If-None-Match')
    if (ifNoneMatch === etag) {
      // Return 304 Not Modified if ETags match
      return new Response(null, {
        status: 304,
        headers: {
          'ETag': etag,
          'Cache-Control': computeCacheControl(startDate, endDate),
          'Vary': 'Accept-Encoding, Authorization',
        },
      })
    }

    // Check Redis cache first for server-side caching
    const cachedData = await cacheService.get(cacheKey)
    if (cachedData) {
      // Return cached data with appropriate headers
      return new Response(cachedData, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': computeCacheControl(startDate, endDate),
          'ETag': etag,
          'X-Cache': 'HIT',
          'Vary': 'Accept-Encoding, Authorization',
        },
      })
    }

    // Get repository
    const emotionsRepository = getEmotionsRepository()

    // Performance measurement
    const startTime = performance.now()

    // Fetch dimensional emotion data
    const dimensionalData = await emotionsRepository.getDimensionalEmotions({
      clientId,
      startDate,
      endDate,
      limit,
    })

    // Measure query time
    const queryTime = performance.now() - startTime

    // Transform to expected API response format
    const response = {
      data: dimensionalData.map((item: DimensionalEmotionMap) => ({
        timestamp: item.timestamp.getTime(),
        dimensions: {
          valence: item.primaryVector.valence,
          arousal: item.primaryVector.arousal,
          dominance: item.primaryVector.dominance,
        },
        mappedEmotion: item.mappedEmotion,
      })),
      meta: {
        totalCount: dimensionalData.length,
        pageCount: 1,
        hasMore: false,
        queryTimeMs: Math.round(queryTime),
      },
    }

    // Convert to JSON just once
    const responseJson = JSON.stringify(response)

    // Store in Redis cache with appropriate TTL
    const cacheTTL = computeCacheTTLSeconds(startDate, endDate)
    await cacheService.set(cacheKey, responseJson, cacheTTL)

    return new Response(responseJson, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': computeCacheControl(startDate, endDate),
        'ETag': etag,
        'X-Cache': 'MISS',
        'X-Response-Time': `${Math.round(queryTime)}ms`,
        'Vary': 'Accept-Encoding, Authorization',
      },
    })
  } catch (error) {
    console.error('Error fetching dimensional emotions:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch emotion data' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      },
    )
  }
}

/**
 * Compute appropriate cache TTL based on date range
 * Recent data expires more quickly than historical data
 */
function computeCacheTTLSeconds(startDate?: Date, endDate?: Date): number {
  if (!startDate || !endDate) {
    return 300 // Default: 5 minutes
  }

  const now = new Date()
  const oneDayMs = 24 * 60 * 60 * 1000

  // If date range includes the current day, shorter cache time
  if (endDate.getTime() > now.getTime() - oneDayMs) {
    return 120 // 2 minutes for recent data
  }

  // If date range is within the last week
  if (endDate.getTime() > now.getTime() - 7 * oneDayMs) {
    return 300 // 5 minutes for weekly data
  }

  // If date range is within the last month
  if (endDate.getTime() > now.getTime() - 30 * oneDayMs) {
    return 900 // 15 minutes for monthly data
  }

  // Historical data can be cached longer
  return 3600 // 1 hour for historical data
}

/**
 * Generate Cache-Control header based on date range
 */
function computeCacheControl(startDate?: Date, endDate?: Date): string {
  const ttl = computeCacheTTLSeconds(startDate, endDate)
  return `max-age=${ttl}, s-maxage=${ttl * 2}, stale-while-revalidate=${ttl * 5}`
}

/**
 * Simple string hashing function for ETag generation
 */
function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash &= hash // Convert to 32bit integer
  }
  return hash.toString(36)
}
