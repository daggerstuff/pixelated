
import { useSession } from '@/lib/auth-client'
import type { AuthRole } from '@/config/auth.config'
import type { UserRole } from '@/types/auth'

interface RequireRoleProps {
  children: React.ReactNode
  role: AuthRole | AuthRole[] | UserRole | UserRole[]
  fallback?: React.ReactNode
}

/**
 * RequireRole component - Checks if current user has required role
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
  const { data: session } = useSession()
  
  // If no session, show fallback
  if (!session?.user) {
    return <>{fallback}</>
  }
  
  // Convert role to array for easier checking
  const requiredRoles = Array.isArray(role) ? role : [role]
  const userRole = session.user.role
  
  // Check if user has any of the required roles
  const hasRequiredRole = requiredRoles.some(
    (requiredRole) => 
      userRole === requiredRole || 
      userRole?.toLowerCase() === requiredRole.toLowerCase()
  )
  
  if (!hasRequiredRole) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}
