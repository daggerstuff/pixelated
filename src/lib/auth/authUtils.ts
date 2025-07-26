import type { AuthUser } from './types'
import { createClient } from '@supabase/supabase-js'

import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('auth-utils')

/**
 * Check if the user is authenticated
 * @param request The request object or Astro cookies
 * @returns True if the user is authenticated, false otherwise
 */
export async function isAuthenticated(
  request?: Request | AstroCookies,
): Promise<boolean> {
  try {
    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    )

    // Even though we're not using request parameter yet,
    // we can log it for debugging and future implementation
    if (request) {
      logger.info('Authentication request received')
    }

    const { data, error } = await supabase.auth.getSession()

    if (error || !data?.session) {
      return false
    }

    return true
  } catch (error) {
    logger.error('Error checking authentication:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
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
  } catch (error) {
    logger.error('Error checking admin role:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return false
  }
}
