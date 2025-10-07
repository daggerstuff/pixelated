// MongoDB-based authentication service
// Replaced Supabase Auth with MongoDB + JWT authentication

import * as adapter from '@/adapters/betterAuthMongoAdapter'
import type { User } from '@/types/mongodb.types'

// Prefer adapter exports for auth operations so callers don't depend on internal mongoAuthService
export default adapter

// Export user type
export type { User }

export const createUser = adapter.createUser
export const signIn = adapter.signIn
export const signOut = adapter.revokeToken
export const verifyAuthToken = adapter.verifyToken
export const getUserById = adapter.getUserById
export const updateUser = adapter.updateUser
export const changePassword = async (userId: string, newPassword: string) => {
  // delegate to the runtime mongoAuthService implementation if available
  const svc = (await import('@/services/mongoAuth.service')).mongoAuthService as unknown
  if (svc && typeof (svc as unknown as Record<string, unknown>)['changePassword'] === 'function') {
    return await (svc as unknown as { changePassword: (u: string, p: string) => Promise<void> }).changePassword(userId, newPassword)
  }
  throw new Error('changePassword not available')
}
