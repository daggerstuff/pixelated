import type { APIRoute } from 'astro'
import { rateLimitConfig } from '@/config/rate-limit.config'
import { fheService } from '@/lib/fhe'
import { createBuildSafeLogger } from '../../../../lib/logging/build-safe-logger'
import { RateLimiter } from '@/lib/middleware/rate-limit'
import { EncryptionMode } from '@/lib/fhe/types'

export const POST: APIRoute = async ({ request, cookies }) => {
  // Create a rate limiter instance with specific config for sensitive operations
  const rateLimit = new RateLimiter(
    rateLimitConfig.sensitive.maxRequests,
    rateLimitConfig.sensitive.windowMs,
  )

  try {
    // Apply rate limiting (stricter for key rotation)
    const rateLimitResult = await rateLimit.check(
      request.headers.get('x-forwarded-for') || 'anonymous',
      'key-rotation',
    )

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          },
        },
      )
    }

    // Verify authentication and authorization
    // In a real implementation, we'd check for proper admin privileges
    // For this demo, we'll assume the user is authorized if they have a session
    const sessionToken = cookies.get('session')
    if (!sessionToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Authentication required',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Initialize FHE service if not already initialized
    if (!fheService.isInitialized()) {
      await fheService.initialize({
        mode: EncryptionMode.FHE,
        securityLevel: 'high',
        enableDebug: import.meta.env.PROD !== true,
      })
    }

    // Rotate the key with the correct mode value
    const result = await fheService.rotateKeys()

    // Return success with new key ID
    return new Response(
      JSON.stringify({
        success: true,
        keyId: result,
        timestamp: Date.now(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    createBuildSafeLogger('default').error(
      `Key rotation API error: ${(error as Error).message}`,
    )

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to rotate encryption keys',
        message:
          import.meta.env.PROD !== true ? (error as Error).message : undefined,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
