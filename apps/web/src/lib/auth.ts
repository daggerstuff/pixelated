/**
 * Compatibility barrel for legacy imports targeting `@/lib/auth`.
 * The real implementation lives under `src/lib/auth/index.ts`.
 */

export {
  auth,
  getCurrentUser,
  getSession,
  getUserById,
  hasRole,
  initializeAuthSystem,
  isAuthenticated,
  requireAuth,
  requirePageAuth,
} from './auth/index'
export type { SessionData } from './auth/index'
export { auth as default } from './auth/index'
