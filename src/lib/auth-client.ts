import { createAuthClient } from 'better-auth/react'

/**
 * Better-Auth React Client
 * Configured to work with the better-auth API routes at /api/auth
 */
export const authClient = createAuthClient({
  baseURL: '/api/auth',
})
