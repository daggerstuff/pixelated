import type { APIRoute } from 'astro'
import { emotionValidationPipeline } from '../../../../lib/ai/emotions/EmotionValidationPipeline'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { isAuthenticated } from '@/lib/auth'
import {
  createAuditLog,
  AuditEventType,
  AuditEventStatus,
} from '../../../../lib/audit'

// Simple in-memory rate limiter (per user or IP)
const rateLimitMap = new Map()
const RATE_LIMIT = 10 // requests
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute

export const GET: APIRoute = async ({ request }) => {
  const logger = createBuildSafeLogger('validation-api')

  try {
    // Authenticate the request
    const authResult = await isAuthenticated(request as any)
    if (!authResult) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const userKey =
      authResult['authenticated'] && authResult['user']?.['id']
        ? `user:${authResult['user']['id']}`
        : `ip:${request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || 'unknown'}`
    const now = Date.now()
    let entry = rateLimitMap.get(userKey)
    if (!entry || now - entry.start > RATE_LIMIT_WINDOW_MS) {
      entry = { count: 0, start: now }
    }
    entry.count++
    rateLimitMap.set(userKey, entry)
    if (entry.count > RATE_LIMIT) {
      return new Response(
        JSON.stringify({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Try again later.',
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Check user permissions (must be admin)
    if (!authResult['user']?.['isAdmin']) {
      // Create audit log for unauthorized access attempt
      await createAuditLog(
        AuditEventType.SECURITY,
        'validation-pipeline-results-unauthorized',
        authResult['user']?.['id'] || 'unknown',
        'validation-api',
        {
          userId: authResult['user']?.['id'],
          email: authResult['user']?.['email'],
        },
        AuditEventStatus.FAILURE,
      )

      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'You do not have permission to view validation results',
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Initialize if not already initialized
    if (!emotionValidationPipeline.isInitialized) {
      await emotionValidationPipeline.initialize()
    }

    // Get validation results
    const validationResults = emotionValidationPipeline.getValidationResults()
    const validationStats = emotionValidationPipeline.getValidationStats()

    // Create audit log for successful retrieval
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'validation-pipeline-results',
      authResult['user']?.['id'] || 'system',
      'validation-api',
      {
        userId: authResult['user']?.['id'],
        resultsCount: validationResults.length,
      },
      AuditEventStatus.SUCCESS,
    )

    // Prepare response data (combine stats and results)
    const responseData = {
      ...validationStats,
      results: validationResults,
      timestamp: new Date().toISOString(),
    }

    // Return results, with caching headers (no-store, private for admin data)
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, private',
        'ETag': `"validation-${validationResults.length}-${validationStats.metrics.processed}"`,
      },
    })
  } catch (error: unknown) {
    // Log the error
    const errorMessage =
      error instanceof Error ? String(error) : 'Unknown error'
    logger.error(`Error retrieving validation results: ${errorMessage}`)

    // Create audit log for failed retrieval
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'validation-pipeline-results',
      'system',
      'validation-api',
      {
        error: errorMessage,
      },
      AuditEventStatus.FAILURE,
    )

    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: `Failed to retrieve validation results: ${errorMessage}`,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}
