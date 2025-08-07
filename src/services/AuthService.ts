// MongoDB-based authentication service
// Replaced Supabase Auth with MongoDB + JWT authentication

import { mongoAuthService } from '@/services/mongoAuth.service'
import type { User } from '@/types/mongodb.types'

// Export MongoDB auth service as default
export default mongoAuthService

// Export user type
export type { User }

// Export commonly used auth methods
export const {
  createUser,
  signIn,
  signOut,
  verifyAuthToken,
  getUserById,
  updateUser,
  changePassword,
} = mongoAuthService
