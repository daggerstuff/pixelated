import { useEffect } from 'react'
import { authClient } from '@/lib/auth-client'
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
 */
export function ProtectedRoute({
  children,
  requiredRole,
  redirectTo = '/login',
  fallback,
}: ProtectedRouteProps) {
  const { data: session, isPending: loading } = authClient.useSession()

  // Simple role check function
  const hasRole = (role: AuthRole | AuthRole[] | UserRole | UserRole[]): boolean => {
    if (!session?.user) {
      return false
    }

    const userRole = session.user.role

    if (Array.isArray(role)) {
      return (role as string[]).includes(userRole)
    }

    return userRole === role
  }

  useEffect(() => {
    if (!loading && !session) {
      const currentPath = window.location.pathname
      window.location.href = `${redirectTo}?redirect=${encodeURIComponent(currentPath)}`
    }
  }, [session, loading, redirectTo])

  // Show loading state
  if (loading) {
    return (
      fallback ?? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto"></div>
            <p className="mt-4 text-gray-400">Verifying session...</p>
          </div>
        </div>
      )
    )
  }

  // Not authenticated
  if (!session) {
    return (
      fallback ?? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
            <h2 className="text-2xl font-bold text-white mb-2">
              Authentication Required
            </h2>
            <p className="text-gray-400 mb-6">
              Please log in to your account to access this page.
            </p>
            <a
              href={redirectTo}
              className="inline-block w-full py-3 bg-green-500 text-black font-semibold rounded-xl hover:bg-green-400 transition-colors"
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
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
            <h2 className="text-2xl font-bold text-red-400 mb-2">
              Access Denied
            </h2>
            <p className="text-gray-400 mb-6">
              You don't have the required permissions to access this page.
            </p>
            <a
              href="/"
              className="inline-block w-full py-3 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-colors"
            >
              Back to Safety
            </a>
          </div>
        </div>
      )
    )
  }

  return <>{children}</>
}
