/**
 * Token Refresh API Endpoint
 * Handles JWT token refresh with Better-Auth integration
 */

import type { APIRoute } from 'astro'
import { refreshAccessToken } from '@/lib/auth/jwt-service'
import { rateLimitMiddleware } from '@/lib/auth/middleware'
import { logSecurityEvent } from '@/lib/security'

export const POST: APIRoute = async ({ request, clientAddress }) => {
  // Extract client information early so it's available in the catch block
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const deviceId = request.headers.get('x-device-id') || 'unknown'
  const clientInfo = {
    ip: clientAddress || 'unknown',
    userAgent,
    deviceId,
  }

  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimitMiddleware(
      request as any,
      'refresh',
      20,
      60,
    )

    if (!rateLimitResult.success) {
      return rateLimitResult.response!
    }

    // Parse and validate request body
    const body = await request.json()

    if (!body || !body.refreshToken) {
      return new Response(
        JSON.stringify({
          error: 'Missing refresh token',
          details: ['refreshToken'],
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const { refreshToken } = body

    // Attempt token refresh
    const tokenPair = await refreshAccessToken(refreshToken, clientInfo)

    // Log successful token refresh
    await logSecurityEvent('token_refreshed', {
      clientInfo,
      timestamp: Date.now(),
    })

    return new Response(JSON.stringify({ success: true, tokenPair }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      },
    })
  } catch (err: unknown) {
    // Narrow the unknown error to access properties safely
    const error =
      typeof err === 'object' && err !== null
        ? (err as { message?: string; name?: string; details?: unknown })
        : { message: String(err), name: undefined }

    // Handle specific authentication errors
    if (error.name === 'AuthenticationError') {
      await logSecurityEvent('token_validation_failed', {
        error: error.message,
        clientInfo,
        timestamp: Date.now(),
      })

      return new Response(
        JSON.stringify({ error: error.message, details: error.details || {} }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Handle unexpected errors
    console.error('Token refresh error:', err)

    await logSecurityEvent('error', {
      error: error.message || String(err),
      clientInfo,
      timestamp: Date.now(),
    })

    return new Response(
      JSON.stringify({
        error: 'Token refresh failed',
        message: 'An unexpected error occurred. Please try again later.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

// Handle OPTIONS requests for CORS
export const OPTIONS: APIRoute = async ({ request }) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-CSRF-Token, X-Device-ID',
      'Access-Control-Max-Age': '86400',
    },
  })
}
