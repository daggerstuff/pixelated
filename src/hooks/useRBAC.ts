import { useAuth } from './useAuth'
import type { AuthRole } from '@/config/auth.config'
import type { UserRole } from '@/types/auth'

/**
 * Hook for role-based access control
 * 
 * Usage:
 * ```tsx
 * const { hasAccess, isLoading } = useRBAC('admin')
 * const { hasAccess: hasStaffAccess } = useRBAC(['admin', 'staff'])
 * ```
 */
export function useRBAC(requiredRole: AuthRole | AuthRole[] | UserRole | UserRole[]) {
  const { user, loading, hasRole } = useAuth()

  return {
    hasAccess: hasRole(requiredRole),
    isLoading: loading,
    isAuthenticated: !!user,
    user,
  }
}

