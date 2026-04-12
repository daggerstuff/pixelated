// src/lib/auth/route-protection.ts
/**
 * Route protection utilities for dual-mode authentication
 */

import { authenticateRequest, AuthenticatedRequest } from './auth0-middleware'

export type AuthMode = 'jwt' | 'api_key' | 'either'
export type RouteScope = string

export interface RouteProtectionOptions {
  strategy: 'jwtOnly' | 'apiKeyOnly' | 'either'
  requiredScopes?: RouteScope[]
}

/**
 * Protect an API route with specific authentication requirements
 */
export async function protectRoute(
  request: Request,
  options: RouteProtectionOptions
): Promise<{
  success: boolean
  request?: AuthenticatedRequest
  response?: Response
  error?: string
}> {
  return await authenticateRequest(request, {
    strategy: options.strategy,
    requiredScopes: options.requiredScopes || []
  })
}

/**
 * Convenience functions for common route types
 */

export const jwtOnly = (requiredScopes?: RouteScope[]) =>
  ({ strategy: 'jwtOnly' as const, requiredScopes })

export const apiKeyOnly = (requiredScopes?: RouteScope[]) =>
  ({ strategy: 'apiKeyOnly' as const, requiredScopes })

export const eitherAuth = (requiredScopes?: RouteScope[]) =>
  ({ strategy: 'either' as const, requiredScopes })

/**
 * Route families with their default protection
 */
export const ROUTE_FAMILIES = {
  // User-facing routes (require JWT)
  user: {
    auth: jwtOnly(),
    profile: jwtOnly(),
    conversations: jwtOnly(),
  },

  // Developer API routes (require API key)
  developer: {
    inference: apiKeyOnly(['read']),
    training: apiKeyOnly(['write']),
    admin: apiKeyOnly(['admin']),
  },

  // Public routes (either auth)
  public: {
    health: eitherAuth(),
    docs: eitherAuth(),
  },

  // Internal routes (special handling)
  internal: {
    metrics: jwtOnly(['admin']),
  }
} as const

export type RouteFamily = keyof typeof ROUTE_FAMILIES
export type RouteType = string