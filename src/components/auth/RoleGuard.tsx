import { authClient } from '@/lib/auth-client'
import { useStore } from 'nanostores'
import type { AuthRole } from '@/config/auth.config'
import type { UserRole } from '@/types/auth'

export interface RoleGuardProps {
  children: React.ReactNode
  requiredRole: AuthRole | AuthRole[] | UserRole | UserRole[]
  fallback?: React.ReactNode
  showError?: boolean
}

/**
 * RoleGuard component - Conditionally renders children based on user role
 * 
 * Usage:
 * ```tsx
 * <RoleGuard requiredRole="admin">
 *   <AdminPanel />
 * </RoleGuard>
 * 
 * <RoleGuard requiredRole={["admin", "staff"]} fallback={<p>Access denied</p>}>
 *   <StaffPanel />
 * </RoleGuard>
 * ```
 */
export function RoleGuard({
  children,
  requiredRole,
  fallback = null,
  showError = false,
}: RoleGuardProps) {
  const { data: user, isPending: loading } = authClient.useSession()

  // Simple role check function for better-auth user
  const hasRole = (role: AuthRole | AuthRole[] | UserRole | UserRole[]): boolean => {
    if (!user?.user) {
      return false
    }

    const userRoles = user.user.roles || []

    if (Array.isArray(role)) {
      return role.some(r => userRoles.includes(r))
    }

    return userRoles.includes(role)
  }

  // Show nothing while loading
  if (loading) {
    return null
  }

  // Not authenticated
  if (!user) {
    return showError ? (
      <div className="text-red-600 text-sm">Authentication required</div>
    ) : (
      <>{fallback}</>
    )
  }

  // Check role
  if (!hasRole(requiredRole)) {
    return showError ? (
      <div className="text-red-600 text-sm">Insufficient permissions</div>
    ) : (
      <>{fallback}</>
    )
  }

  return <>{children}</>
}

