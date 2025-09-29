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
