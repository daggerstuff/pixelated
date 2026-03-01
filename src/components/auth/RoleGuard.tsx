import type { AuthRole } from '@/config/auth.config'
import { authClient } from '@/lib/auth-client'
import type { UserRole } from '@/types/auth'

export interface RoleGuardProps {
  children: React.ReactNode
  requiredRole: AuthRole | AuthRole[] | UserRole | UserRole[]
  fallback?: React.ReactNode
  showError?: boolean
}

/**
 * RoleGuard component - Conditionally renders children based on user role
 * Uses custom Auth0-backed authClient.
 */
export function RoleGuard({
  children,
  requiredRole,
  fallback = null,
  showError = false,
}: RoleGuardProps) {
  const { data: session, isPending: loading } = authClient.useSession()

  // Simple role check function
  const hasRole = (
    role: AuthRole | AuthRole[] | UserRole | UserRole[],
  ): boolean => {
    if (!session?.user) {
      return false
    }

    const userRole = session.user.role

    if (Array.isArray(role)) {
      return (role as string[]).includes(userRole)
    }

    return userRole === role
  }

  // Show nothing while loading
  if (loading) {
    return null
  }

  // Not authenticated
  if (!session) {
    return showError ? (
      <div className='text-red-500 bg-red-500/10 border-red-500/20 rounded-lg border p-4 text-sm'>
        Authentication required
      </div>
    ) : (
      <>{fallback}</>
    )
  }

  // Check role
  if (!hasRole(requiredRole)) {
    return showError ? (
      <div className='text-red-500 bg-red-500/10 border-red-500/20 rounded-lg border p-4 text-sm'>
        Insufficient permissions
      </div>
    ) : (
      <>{fallback}</>
    )
  }

  return <>{children}</>
}
