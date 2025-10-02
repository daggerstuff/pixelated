/**
 * Authentication Middleware - Request authentication validation with Better-Auth integration
 * Provides role-based authorization and permission checking
 */

import type { Request } from 'express'

export interface ClientInfo {
  ip?: string
  userAgent?: string
  deviceId?: string
}

/**
 * Extract token from request headers or query parameters
 */
export function extractTokenFromRequest(req: Request): string | null {
  // Check Authorization header first
  const authHeader = req.headers.authorization

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7) // Remove 'Bearer ' prefix
  }

  // Check query parameters for WebSocket connections
  const tokenParam = req.query.token as string

  if (tokenParam) {
    return tokenParam
  }

  // Check cookie for fallback
  const tokenCookie = req.cookies?.auth_token

  if (tokenCookie) {
    return tokenCookie
  }

  return null
}

/**
 * Get client IP address
 */
export function getClientIp(req: Request): string {
  return req.ip ||
         req.headers['x-forwarded-for'] as string ||
         req.headers['x-real-ip'] as string ||
         'unknown'
}

/**
 * Verify admin access for protected routes
 */
export async function verifyAdmin(
  request: Request,
  context: { session?: unknown }
): Promise<Response | null> {
  try {
    // Check if session exists and has admin role
    const session = context.session as { user?: { roles?: string[] } } | undefined
    if (!session || !session.user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    }

    // Check if user has admin role
    const userRoles = session.user.roles || []
    if (!userRoles.includes('admin') && !userRoles.includes('superadmin')) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    }

    // Admin access verified - return null to continue
    return null
  } catch (error) {
    console.error('Admin verification error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error during admin verification' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
  }
}
