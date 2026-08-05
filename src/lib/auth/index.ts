/**
 * Authentication Module - Main export for Phase 7 JWT Authentication Service
 * Provides complete authentication system with Auth0 integration
 */

import type { AstroCookies } from 'astro'

import { authConfig } from '../../config/auth.config'
import { validateToken } from './auth0-jwt-service'
import { extractTokenFromRequest } from './auth0-middleware'

// Re-export session for compatibility
export { getSession } from './session'

// Re-export User type for compatibility
export type { User } from './types'

/**
 * Distinguish Web API Request from AstroCookies.
 * AstroCookies exposes a `headers()` method, so `"headers" in context` is not
 * sufficient — that false positive caused PIX-4245 on pages passing cookies.
 */
function isWebRequest(context: Request | AstroCookies): context is Request {
  return (
    typeof (context as Request).url === 'string' &&
    (context as Request).headers instanceof Headers
  )
}

/**
 * Get the current user from the request or cookies
 * Supports both JWT (users) and API keys (developers)
 */
export async function getCurrentUser(context: Request | AstroCookies): Promise<{
  id: string
  role: string
  accountId?: string
  workspaceId?: string
  scopes?: string[]
} | null> {
  let token: string | null = null
  let isApiKey = false

  if (isWebRequest(context)) {
    const request = context

    // Check for API key first (X-API-Key header)
    const apiKey = request.headers.get('X-API-Key')
    if (apiKey) {
      isApiKey = true
      // Validate API key and return developer user
      const developerUser = await validateApiKeyAndGetUser(apiKey)
      if (developerUser) {
        return developerUser
      }
      // If API key invalid, fall through to check JWT
    }

    // Fallback to JWT token extraction
    token = extractTokenFromRequest(request)
  } else {
    const cookies = context
    // Check for Auth0 token first, then fallback to configured name
    token =
      cookies.get(authConfig.cookies.accessToken)?.value ??
      cookies.get('auth_token')?.value ??
      null
  }

  if (!token && !isApiKey) {
    return null
  }

  // If we had an API key but it was invalid, we already returned null above
  // If we have a JWT token, validate it
  if (token) {
    try {
      const result = await validateToken(token, 'access')
      if (result.valid && result.userId) {
        return {
          id: result.userId,
          role: result.role ?? 'guest',
          accountId: result.accountId,
          workspaceId: result.workspaceId,
        }
      }
    } catch {
      // Token validation failed
    }
  }

  return null
}

/**
 * Check if the current user has the specified role
 */
export async function hasRole(
  context: AstroCookies | Request,
  role: string,
): Promise<boolean> {
  const user = await getCurrentUser(context)
  if (!user) {
    return false
  }
  return user.role === role
}

/**
 * Check if the current user is authenticated
 */
export async function isAuthenticated(
  context: AstroCookies | Request,
): Promise<boolean> {
  const user = await getCurrentUser(context)
  return !!user
}

// Export server-side auth functionality
export { authenticateRequest } from './auth0-middleware'

/**
 * Validate API key and return developer user information.
 * Delegates to DeveloperApiKeyManager for proper database-backed validation.
 *
 * @param apiKey The API key to validate
 * @returns User information if valid API key, null otherwise
 */
async function validateApiKeyAndGetUser(
  apiKey: string,
): Promise<{ id: string; role: string; scopes: string[] } | null> {
  const { developerApiKeyManager } = await import('@/lib/db/developer-api-keys')

  const validation = await developerApiKeyManager.validateApiKey(apiKey)

  if (!validation.valid || !validation.api_key) {
    return null
  }

  const keyRecord = validation.api_key
  return {
    id: keyRecord.user_id,
    role: keyRecord.scopes.includes('admin') ? 'admin' : 'developer',
    scopes: keyRecord.scopes,
  }
}
