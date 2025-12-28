/**
 * Authentication utilities for Journal Research API
 * Integrates with Better Auth for session management
 */

import { authClient } from '@/lib/auth-client'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('journal-research-auth')

/**
 * Get the current authentication token from Better Auth session
 * @returns The authentication token or null if not authenticated
 */
export async function getJournalResearchAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const session = await authClient.getSession()
    
    if (session?.data?.session?.token) {
      return session.data.session.token
    }

    // Fallback to localStorage for backward compatibility
    return (
      window.localStorage.getItem('auth_token') ??
      window.localStorage.getItem('authToken') ??
      null
    )
  } catch (error) {
    logger.warn('Failed to get auth token from Better Auth', { error })
    
    // Fallback to localStorage
    try {
      return (
        window.localStorage.getItem('auth_token') ??
        window.localStorage.getItem('authToken') ??
        null
      )
    } catch (localStorageError) {
      logger.warn('Failed to read auth token from localStorage', {
        error: localStorageError,
      })
      return null
    }
  }
}

/**
 * Check if the user is authenticated
 * @returns True if authenticated, false otherwise
 */
export async function isJournalResearchAuthenticated(): Promise<boolean> {
  const token = await getJournalResearchAuthToken()
  return token !== null
}

/**
 * Handle unauthorized access by redirecting to login
 * @param redirectPath Optional path to redirect to after login
 */
export function handleJournalResearchUnauthorized(
  redirectPath?: string,
): void {
  if (typeof window === 'undefined') {
    return
  }

  const currentPath = redirectPath ?? window.location.pathname
  window.location.href = `/auth/sign-in?redirect=${encodeURIComponent(currentPath)}`
}

