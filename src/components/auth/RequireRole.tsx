import { useAuth } from '@/hooks/useAuth'
import type { AuthRole } from '@/config/auth.config'
import type { UserRole } from '@/types/auth'

interface RequireRoleProps {
  children: React.ReactNode
  role: AuthRole | AuthRole[] | UserRole | UserRole[]
  fallback?: React.ReactNode
}

/**
 * RequireRole component - Alias for RoleGuard with clearer naming
 * 
 * Usage:
 * ```tsx
 * <RequireRole role="admin">
 *   <AdminContent />
 * </RequireRole>
 * ```
 */
export function RequireRole({
  children,
  role,
  fallback = null,
}: RequireRoleProps) {
  return (
    <RoleGuard requiredRole={role} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

