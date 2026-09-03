/**
 * Stateless helpers for the external threat feed integration system.
 * Extracted from ExternalThreatFeedIntegrationCore to keep the orchestrator
 * focused on lifecycle/state management.
 */

import axios, { AxiosInstance } from 'axios'
import type Redis from 'ioredis'

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { asRedisOps } from '../../redis-ops'
import type {
  FeedConfig,
  FeedItem,
  FeedSubscription,
  FeedSubscriptionRequestConfig,
} from '../global/types'

const logger = createBuildSafeLogger('external-threat-feed-helpers')

export function createThreatFeedHttpClient(): AxiosInstance {
  const httpClient = axios.create({
    timeout: 30000,
    headers: {
      'User-Agent': 'Pixelated-Threat-Feed-Integration/1.0',
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  })

  // Add request/response interceptors for logging
  httpClient.interceptors.request.use(
    (config) => {
      logger.debug('HTTP request', {
        method: config.method,
        url: config.url,
        headers: config.headers,
      })
      return config
    },
    async (error) => {
      logger.error('HTTP request error', { error })
      return Promise.reject(error)
    },
  )

  httpClient.interceptors.response.use(
    (response) => {
      logger.debug('HTTP response', {
        status: response.status,
        statusText: response.statusText,
        url: response.config.url,
      })
      return response
    },
    async (error) => {
      logger.error('HTTP response error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: error.response?.status,
        url: error.config?.url,
      })
      return Promise.reject(error)
    },
  )

  return httpClient
}

export function validateFeedConfig(feedConfig: FeedConfig): void {
  if (!feedConfig.feedId) {
    throw new Error('Feed ID is required')
  }

  if (!feedConfig.provider) {
    throw new Error('Feed provider is required')
  }

  if (!feedConfig.feedType) {
    throw new Error('Feed type is required')
  }

  if (!feedConfig.endpoint) {
    throw new Error('Feed endpoint is required')
  }

  if (!feedConfig.apiKey && feedConfig.requiresAuth) {
    throw new Error('API key is required for authenticated feeds')
  }

  // Validate feed type
  const validFeedTypes = [
    'stix',
    'taxii',
    'misp',
    'otx',
    'virustotal',
    'generic',
  ]
  if (!validFeedTypes.includes(feedConfig.feedType)) {
    throw new Error(`Invalid feed type: ${feedConfig.feedType}`)
  }

  // Validate update frequency
  const validFrequencies = ['real-time', 'hourly', 'daily', 'weekly']
  if (
    feedConfig.updateFrequency &&
    !validFrequencies.includes(feedConfig.updateFrequency)
  ) {
    throw new Error(`Invalid update frequency: ${feedConfig.updateFrequency}`)
  }
}

export function getFeedProcessingInterval(updateFrequency: string): number {
  const intervals: Record<string, number> = {
    'real-time': 5 * 60 * 1000, // 5 minutes
    'hourly': 60 * 60 * 1000, // 1 hour
    'daily': 24 * 60 * 60 * 1000, // 24 hours
    'weekly': 7 * 24 * 60 * 60 * 1000, // 7 days
  }

  return intervals[updateFrequency] ?? 60 * 60 * 1000 // Default to hourly
}

export async function buildFeedRequestConfig(
  subscription: FeedSubscription,
): Promise<Record<string, unknown>> {
  const subConfig: Partial<FeedConfig> & FeedSubscriptionRequestConfig =
    subscription.config ?? {}
  const headers = {
    ...subConfig.headers,
  } as Record<string, string>
  const config: Record<string, unknown> = {
    method: subConfig.method ?? 'GET',
    url: subscription.endpoint,
    headers,
  }

  // Add authentication
  if (subscription.apiKey) {
    switch (subConfig.authType) {
      case 'api_key':
        headers['X-API-Key'] = subscription.apiKey
        break
      case 'bearer':
        headers['Authorization'] = `Bearer ${subscription.apiKey}`
        break
      case 'basic':
        config['auth'] = {
          username: subConfig.username ?? '',
          password: subscription.apiKey,
        }
        break
      case undefined: {
        throw new Error('Not implemented yet: undefined case')
      }
    }
  }

  // Add query parameters
  if (subConfig.queryParams) {
    config['params'] = subConfig.queryParams
  }

  // Add request body for POST requests
  if (config['method'] === 'POST' && subConfig.requestBody) {
    config['data'] = subConfig.requestBody
  }

  return config
}

export function filterFeedItems(
  items: FeedItem[],
  filters: Record<string, unknown>,
): FeedItem[] {
  if (!filters || Object.keys(filters).length === 0) {
    return items
  }

  return items.filter((item) => {
    // Apply severity filter
    if (filters['severity'] && item.severity !== filters['severity']) {
      return false
    }

    // Apply confidence filter
    if (
      filters['minConfidence'] &&
      item.confidence < (filters['minConfidence'] as number)
    ) {
      return false
    }

    // Apply time filter
    if (filters['maxAge']) {
      const itemAge = Date.now() - new Date(item.timestamp).getTime()
      if (itemAge > (filters['maxAge'] as number)) {
        return false
      }
    }

    // Apply custom filter function if provided
    if (
      filters['customFilter'] &&
      typeof filters['customFilter'] === 'function'
    ) {
      return filters['customFilter'](item)
    }

    return true
  })
}

export async function deduplicateFeedItems(
  items: FeedItem[],
  subscription: FeedSubscription,
  redis: Redis,
): Promise<FeedItem[]> {
  try {
    const seenItems = new Set<string>()
    const deduplicatedItems: FeedItem[] = []

    // Get recently processed item IDs from Redis
    const cacheKey = `feed_dedup:${subscription.subscriptionId}`
    const recentItemIds = await redis.smembers(cacheKey)
    recentItemIds.forEach((id) => seenItems.add(id))

    for (const item of items) {
      const itemKey = generateItemKey(item)

      if (!seenItems.has(itemKey)) {
        deduplicatedItems.push(item)
        seenItems.add(itemKey)

        // Add to Redis cache with expiration
        await redis.sadd(cacheKey, itemKey)
      }
    }

    // Set expiration on the deduplication set (24 hours)
    if (redis && typeof asRedisOps(redis).expire === 'function') {
      await asRedisOps(redis).expire(cacheKey, 24 * 60 * 60)
    }

    return deduplicatedItems
  } catch (error: unknown) {
    logger.error('Failed to deduplicate feed items:', { error })
    return items // Return original items if deduplication fails
  }
}

export function generateItemKey(item: FeedItem): string {
  // Generate a unique key based on item characteristics
  const keyParts = [
    item.itemId || '',
    item.indicator || '',
    item.indicatorType || '',
    item.timestamp || '',
  ]

  return keyParts.join('|')
}

export function calculateNextFetchTime(subscription: FeedSubscription): Date {
  const interval = getFeedProcessingInterval(subscription.updateFrequency)
  const lastFetch = subscription.lastFetchTime ?? new Date()

  return new Date(lastFetch.getTime() + interval)
}

export function generateSubscriptionId(): string {
  return `feed_sub_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}