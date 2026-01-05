import { useEffect } from 'react'
import { authClient } from '@/lib/auth-client'
import { useStore } from 'nanostores'
import type { AuthRole } from '@/config/auth.config'
import type { UserRole } from '@/types/auth'

export interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: AuthRole | AuthRole[] | UserRole | UserRole[]
  redirectTo?: string
  fallback?: React.ReactNode
}

/**
 * ProtectedRoute component - Protects routes that require authentication
 * 
 * Usage:
 * ```tsx
 * <ProtectedRoute requiredRole="admin">
 *   <AdminPanel />
 * </ProtectedRoute>
 * ```
 */
export function ProtectedRoute({
  children,
  requiredRole,
  redirectTo = '/login',
  fallback,
}: ProtectedRouteProps) {
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

  useEffect(() => {
    if (!loading && !user) {
      const currentPath = window.location.pathname
      window.location.href = `${redirectTo}?redirect=${encodeURIComponent(currentPath)}`
    }
  }, [user, loading, redirectTo])

  // Show loading state
  if (loading) {
    return (
      fallback ?? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      )
    )
  }

  // Not authenticated
  if (!user) {
    return (
      fallback ?? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Authentication Required
            </h2>
            <p className="text-gray-600 mb-4">
              Please log in to access this page.
            </p>
            <a
              href={redirectTo}
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Go to Login
            </a>
          </div>
        </div>
      )
    )
  }

  // Check role if required
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      fallback ?? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Access Denied
            </h2>
            <p className="text-gray-600 mb-4">
              You don't have permission to access this page.
            </p>
            <a
              href="/"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Go Home
            </a>
          </div>
        </div>
      )
    )
  }

  return <>{children}</>
}

