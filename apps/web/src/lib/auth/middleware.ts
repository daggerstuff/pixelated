/**
 * Middleware entry point.
 * Re-exports from auth0-middleware for backward compatibility.
 */

export * from './auth0-middleware'
export type { UserRole } from './auth0-rbac-service'
export type { ResolvedIdentity } from './user-identity'
export type { AuthenticatedUser } from '../../services/auth0.service'
