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
        <div className='flex min-h-[60vh] items-center justify-center'>
          <div className='text-center'>
            <div className='border-green-500 mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-t-2'></div>
            <p className='text-gray-400 mt-4'>Verifying session...</p>
          </div>
        </div>
      )
    )
  }

  // Not authenticated
  if (!session) {
    return (
      fallback ?? (
        <div className='flex min-h-[60vh] items-center justify-center'>
          <div className='bg-white/5 border-white/10 max-w-md rounded-2xl border p-8 text-center backdrop-blur-md'>
            <h2 className='text-white mb-2 text-2xl font-bold'>
              Authentication Required
            </h2>
            <p className='text-gray-400 mb-6'>
              Please log in to your account to access this page.
            </p>
            <a
              href={redirectTo}
              className='bg-green-500 text-black hover:bg-green-400 inline-block w-full rounded-xl py-3 font-semibold transition-colors'
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
        <div className='flex min-h-[60vh] items-center justify-center'>
          <div className='bg-white/5 border-white/10 max-w-md rounded-2xl border p-8 text-center backdrop-blur-md'>
            <h2 className='text-red-400 mb-2 text-2xl font-bold'>
              Access Denied
            </h2>
            <p className='text-gray-400 mb-6'>
              You don't have the required permissions to access this page.
            </p>
            <a
              href='/'
              className='bg-white/10 text-white hover:bg-white/20 inline-block w-full rounded-xl py-3 font-semibold transition-colors'
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
