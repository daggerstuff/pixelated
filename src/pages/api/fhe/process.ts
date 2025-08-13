import type { FHEOperation } from '@/lib/fhe/types'
import type { APIRoute } from 'astro'
import { fheService } from '@/lib/fhe'
import { EncryptionMode } from '@/lib/fhe/types'
import { createBuildSafeLogger } from '../../../../lib/logging/build-safe-logger'
import { rateLimit } from '@/lib/middleware/rate-limit'

export const POST: APIRoute = async ({ request }) => {
  try {
    // Get client IP for rate limiting
    const clientIp =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('cf-connecting-ip') ||
      'anonymous'

    // Check rate limit
    const rateLimitResult = await rateLimit.check(clientIp, 'anonymous')

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

    // Parse request body
    const body = await request.json()
    const { encryptedData, operation, params = {} } = body

    // Validate input
    if (!encryptedData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Encrypted data is required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (!operation) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Operation is required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
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

    // Process the encrypted data
    const result = await fheService.processEncrypted(
      encryptedData,
      operation as unknown as FHEOperation,
      params,
    )

    // Return the result
    return new Response(
      JSON.stringify({
        success: true,
        result,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    createBuildSafeLogger('default').error(
      `FHE API error: ${(error as Error).message}`,
    )

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to process encrypted data',
        message:
          import.meta.env.PROD !== true ? (error as Error).message : undefined,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
