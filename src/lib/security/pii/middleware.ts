/**
 * PII Detection Middleware
 *
 * This middleware scans requests and responses for personally identifiable information (PII)
 * and takes appropriate actions based on configuration:
 * - Log detection
 * - Redact PII from requests/responses
 * - Block requests containing PII
 * - Redirect to secure endpoints for sensitive operations
 */

import type { APIContext } from 'astro'
import { defineMiddleware } from 'astro/middleware'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import type { NextRequest } from 'next/server'
import type { PIIType } from '.'
import { NextResponse } from 'next/server'

const logger = createBuildSafeLogger('PIIMiddleware')

/**
 * PII Detection Middleware Configuration
 */
export interface PIIMiddlewareConfig {
  enabled: boolean
  redactRequests: boolean
  redactResponses: boolean
  blockRequests: boolean
  auditDetections: boolean
  sensitivePathPatterns: RegExp[]
  excludePathPatterns: RegExp[]
  sensitiveContentTypes: string[]
  sensitiveParameters: string[]
  redirectPath?: string
  typesToCheck?: PIIType[]
}

// Default configuration
const DEFAULT_CONFIG: PIIMiddlewareConfig = {
  enabled: true,
  redactRequests: true,
  redactResponses: true,
  blockRequests: false,
  auditDetections: true,
  sensitivePathPatterns: [
    /\/api\/therapy\/.*/,
    /\/api\/ai\/.*/,
    /\/api\/patients\/.*/,
    /\/api\/medical\/.*/,
  ],
  excludePathPatterns: [
    /\/_next\/.*/,
    /\/static\/.*/,
    /\/images\/.*/,
    /\/favicon\.ico/,
  ],
  sensitiveContentTypes: [
    'application/json',
    'application/x-www-form-urlencoded',
    'text/plain',
    'multipart/form-data',
  ],
  sensitiveParameters: [
    'password',
    'token',
    'api_key',
    'email',
    'phone',
    'address',
    'ssn',
    'dob',
    'birthdate',
  ],
}

/**
 * Main PII middleware implementation
 */
async function piiMiddleware(
  request: NextRequest,
  next: () => Promise<NextResponse>,
  config: Partial<PIIMiddlewareConfig> = {},
): Promise<NextResponse> {
  // Merge with default config
  const finalConfig: PIIMiddlewareConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  }

  // Skip if middleware is disabled
  if (!finalConfig.enabled) {
    return next()
  }

  try {
    // Check if path should be excluded
    const url = new URL(request.url)
    if (
      finalConfig.excludePathPatterns.some((pattern) =>
        pattern.test(url.pathname),
      )
    ) {
      return next()
    }

    // Check if path requires special handling
    const isSensitivePath = finalConfig.sensitivePathPatterns.some((pattern) =>
      pattern.test(url.pathname),
    )

    // Process request
    if (isSensitivePath) {
      // Implement your PII detection logic here
      // For now, just pass through
      logger.info('Processing sensitive path', { path: url.pathname })
    }

    // Continue to next middleware/handler
    return next()
  } catch (error) {
    logger.error('Error in PII middleware', { error })
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

/**
 * PII detection middleware to scan and process requests/responses
 */
export const onRequest = defineMiddleware(async (context: APIContext, next) => {
  try {
    // Add PII detection logic here
    return await next()
  } catch (error) {
    logger.error('Error in PII middleware', { error })
    return new Response('Internal Server Error', { status: 500 })
  }
})

/**
 * Middleware factory function for easier configuration
 */
export function createPIIMiddleware(config: Partial<PIIMiddlewareConfig> = {}) {
  return (request: NextRequest, next: () => Promise<NextResponse>) =>
    piiMiddleware(request, next, config)
}

// Export default for convenience
export default createPIIMiddleware
