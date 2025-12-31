/**
 * Auth0-based Sign Out API Endpoint
 * Handles user sign out with Auth0 integration
 */

import type { APIRoute } from 'astro'
import { validateToken } from '@/lib/auth/auth0-jwt-service'
import { extractTokenFromRequest } from '@/lib/auth/auth0-middleware'
import { revokeRefreshToken } from '@/services/auth0.service'
import { createAuditLog } from '@/lib/audit'

export const prerender = false

/**
 * POST /api/auth/auth0-signout-legacy - Sign out user
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    // Extract token from request
    const token = extractTokenFromRequest(request as unknown as Request)

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'No valid token provided' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate token
    const validation = await validateToken(token, 'access')

    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Revoke refresh token if available
    const refreshToken = request.headers.get('x-refresh-token')
    if (refreshToken) {
      await revokeRefreshToken(refreshToken)
    }

    // Create audit log
    await createAuditLog(
      'user_signout',
      'auth.signout',
      validation.userId || 'anonymous',
      'auth-signout',
      { action: 'sign_out' }
    )

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Signed out successfully',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error: unknown) {
    console.error('Sign out error:', error)

    // Create audit log for the error
    await createAuditLog(
      'system_error',
      'auth.signout.error',
      'anonymous',
      'auth-signout',
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
    )

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? String(error) : 'Sign out failed',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}