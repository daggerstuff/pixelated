/**
 * User Logout API Endpoint
 * Handles user logout and token revocation
 */

import type { APIRoute } from 'astro'
import { logoutFromBetterAuth } from '@/lib/auth/better-auth-integration'
import { authenticateRequest } from '@/lib/auth/middleware'
import { logSecurityEvent } from '@/lib/security'
import { updatePhase6AuthenticationProgress } from '@/lib/mcp/phase6-integration'

interface ClientInfo {
  ip: string
  userAgent: string
  deviceId: string
}

interface AuthenticatedUser {
  id: string
  email?: string
}

interface AuthenticatedRequest {
  user?: AuthenticatedUser
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let clientInfo: ClientInfo | undefined
  try {
    // Extract client information
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const deviceId = request.headers.get('x-device-id') || 'unknown'
    clientInfo = {
      ip: clientAddress || 'unknown',
      userAgent,
      deviceId,
    }

    // Authenticate the request first
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      return authResult.response!
    }

    // Extract session ID from request
    const sessionId = request.headers.get('x-session-id') || 'unknown'

    // Get user ID from authenticated request
    const maybeRequest = authResult.request as unknown as AuthenticatedRequest
    const userId = maybeRequest.user?.id

    if (!userId) {
      return new Response(
        JSON.stringify({
          error: 'User not authenticated',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Perform logout
    await logoutFromBetterAuth(userId, clientInfo)

    // Log successful logout
    await logSecurityEvent('logout', {
      userId,
      sessionId,
      clientInfo,
      timestamp: Date.now(),
    })

    // Update Phase 6 MCP server
    await updatePhase6AuthenticationProgress(userId, 'user_logged_out')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User logged out successfully',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        },
      },
    )
  } catch (error: unknown) {
    // Handle unexpected errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Logout error:', error)
    await logSecurityEvent('error', {
      error: errorMessage,
      clientInfo,
      timestamp: Date.now(),
    })

    return new Response(
      JSON.stringify({
        error: 'Logout failed',
        message: 'An unexpected error occurred. Please try again later.',
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

// Handle OPTIONS requests for CORS
export const OPTIONS: APIRoute = async ({ request }) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-CSRF-Token, X-Device-ID, X-Session-ID',
      'Access-Control-Max-Age': '86400',
    },
  })
}
