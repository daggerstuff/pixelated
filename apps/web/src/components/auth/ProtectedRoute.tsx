import { useEffect } from 'react'

import type { AuthRole } from '@/config/auth.config'
import { authClient } from '@/lib/auth-client'
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
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-none border-b-2 border-t-2 border-ring"></div>
            <p className="mt-4 text-muted-foreground">Verifying session...</p>
          </div>
        </div>
      )
    )
  }

  // Not authenticated
  if (!session) {
    return (
      fallback ?? (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="max-w-md rounded-none border border-border bg-card p-8 text-center">
            <h2 className="text-white mb-2 text-2xl font-bold">
              Authentication Required
            </h2>
            <p className="mb-6 text-muted-foreground">
              Please log in to your account to access this page.
            </p>
            <a
              href={redirectTo}
              className="inline-block w-full rounded-none bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:bg-accent"
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
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="max-w-md rounded-none border border-border bg-card p-8 text-center">
            <h2 className="mb-2 text-2xl font-bold text-foreground">
              Access Denied
            </h2>
            <p className="mb-6 text-muted-foreground">
              You don't have the required permissions to access this page.
            </p>
            <a
              href="/"
              className="inline-block w-full rounded-none border border-border bg-secondary py-3 font-semibold text-foreground transition-colors hover:bg-accent"
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
