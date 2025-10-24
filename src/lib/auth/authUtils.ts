import type { AuthUser } from './types'
import { getSession } from './session'

import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('auth-utils')

/**
 * Check if the user is authenticated
 * @param request The request object or Astro cookies
 * @returns True if the user is authenticated, false otherwise
 */
export async function isAuthenticated(request?: Request): Promise<boolean> {
  try {
    if (!request) {
      logger.info('No request provided for authentication check')
      return false
    }
    // Use MongoDB-based session retrieval
    const sessionData = await getSession(request)
    return sessionData !== null
  } catch (error: unknown) {
    logger.error('Error checking authentication:', {
      error: error instanceof Error ? String(error) : String(error),
      stack: error instanceof Error ? (error as Error)?.stack : undefined,
    })
    return false
  }
}

/**
 * Check if the user has the admin role
 * @param user The authenticated user
 * @returns True if the user has the admin role, false otherwise
 */
export async function hasAdminRole(user: AuthUser): Promise<boolean> {
  try {
    // Check if the user has the 'admin' role
    return user.role === 'admin'
  } catch (error: unknown) {
    logger.error('Error checking admin role:', {
      error: error instanceof Error ? String(error) : String(error),
      stack: error instanceof Error ? (error as Error)?.stack : undefined,
    })
    return false
  }
}
