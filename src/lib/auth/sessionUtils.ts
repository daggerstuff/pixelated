import type { AuthUser } from './types'
import { getSession } from './session'
import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('session-utils')

/**
 * Get the current authenticated user via MongoDB session
 * @param request The request object (must contain auth token)
 */
export async function getUser(request: Request): Promise<AuthUser | null> {
  try {
    const sessionData = await getSession(request)
    if (!sessionData) {
      return null
    }
    const { user } = sessionData

    // Map MongoDB user to AuthUser
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.email.split('@')[0],
      role: user.role,
      permissions: [],
      metadata: {},
    }
  } catch (error: unknown) {
    logger.error('Error getting user:', error as Record<string, unknown>)
    return null
  }
}
