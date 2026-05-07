import { createHash } from 'crypto'

import { developerApiKeyManager } from '@/lib/db/developer-api-keys'

import { LRUCache } from './lru-cache'

const ALLOWED_ORIGINS = [
  'https://app.pixelatedempathy.com',
  'https://api.pixelatedempathy.com',
  process.env.ALLOWED_ORIGIN,
  process.env.DEV_ALLOWED_ORIGIN,
].filter(
  (origin): origin is string => typeof origin === 'string' && origin.length > 0,
)

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']

const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-API-Key',
  'X-Request-ID',
  'X-Client-Version',
]

const EXPOSED_HEADERS = [
  'X-Request-ID',
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
]

const MAX_AGE = 86400

interface CorsValidationCache {
  valid: boolean
  timestamp: number
}

const CORS_CACHE_TTL_MS = 30 * 1000
const MAX_CORS_CACHE_SIZE = 1000

const corsValidationCache = new LRUCache<string, CorsValidationCache>(
  MAX_CORS_CACHE_SIZE,
)

function hashCacheKey(apiKey: string): string {
  return createHash('sha256')
    .update(apiKey.substring(0, 8))
    .digest('hex')
    .substring(0, 16)
}

function getCachedCorsValidation(cacheKey: string): boolean | null {
  const cached = corsValidationCache.get(cacheKey)
  if (!cached) return null
  if (Date.now() - cached.timestamp > CORS_CACHE_TTL_MS) {
    return null
  }
  return cached.valid
}

function setCachedCorsValidation(cacheKey: string, valid: boolean): void {
  corsValidationCache.set(cacheKey, { valid, timestamp: Date.now() })
}

export function isDeveloperApiRequest(request: Request): boolean {
  const url = new URL(request.url)
  return (
    url.pathname.startsWith('/api/developer/') ||
    url.pathname.startsWith('/api/v1/')
  )
}

export async function getDeveloperCorsHeaders(
  request: Request,
): Promise<Headers> {
  const headers = new Headers()
  const origin = request.headers.get('Origin') || request.headers.get('origin')

  if (!origin) {
    return headers
  }

  if (!ALLOWED_ORIGINS.includes(origin)) {
    return headers
  }

  headers.set('Access-Control-Allow-Origin', origin)
  headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '))
  headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '))
  headers.set('Access-Control-Expose-Headers', EXPOSED_HEADERS.join(', '))
  headers.set('Access-Control-Allow-Credentials', 'true')
  headers.set('Access-Control-Max-Age', MAX_AGE.toString())
  headers.set('Vary', 'Origin')

  return headers
}

export async function getDeveloperCorsHeadersWithApiKeyValidation(
  request: Request,
): Promise<Headers> {
  const headers = new Headers()
  const origin = request.headers.get('Origin') || request.headers.get('origin')

  if (!origin) {
    return headers
  }

  if (ALLOWED_ORIGINS.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '))
    headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '))
    headers.set('Access-Control-Expose-Headers', EXPOSED_HEADERS.join(', '))
    headers.set('Access-Control-Allow-Credentials', 'true')
    headers.set('Access-Control-Max-Age', MAX_AGE.toString())
    headers.set('Vary', 'Origin')
    return headers
  }

  const apiKey = request.headers.get('X-API-Key')
  if (!apiKey) {
    return headers
  }

  const cacheKey = `cors:${hashCacheKey(apiKey)}`
  const cachedResult = getCachedCorsValidation(cacheKey)

  if (cachedResult !== null) {
    if (cachedResult) {
      headers.set('Access-Control-Allow-Origin', origin)
      headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '))
      headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '))
      headers.set('Access-Control-Expose-Headers', EXPOSED_HEADERS.join(', '))
      headers.set('Access-Control-Allow-Credentials', 'true')
      headers.set('Access-Control-Max-Age', MAX_AGE.toString())
      headers.set('Vary', 'Origin')
    }
    return headers
  }

  const validation = await developerApiKeyManager.validateApiKey(apiKey)
  const isValid = validation.valid

  setCachedCorsValidation(cacheKey, isValid)

  if (isValid) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '))
    headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '))
    headers.set('Access-Control-Expose-Headers', EXPOSED_HEADERS.join(', '))
    headers.set('Access-Control-Allow-Credentials', 'true')
    headers.set('Access-Control-Max-Age', MAX_AGE.toString())
    headers.set('Vary', 'Origin')
  }

  return headers
}
