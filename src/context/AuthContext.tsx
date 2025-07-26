import type { ReactNode } from 'react'
import type { AuthResult, AuthState, Provider, UserRole } from '../types/auth'
// Import necessary libraries and types
import { createContext, useContext } from 'react'
import { useAuth } from '../hooks/useAuth'

// Create the full context type with auth methods
interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<AuthResult>
  signOut: () => Promise<void>
  signInWithOAuth: (provider: Provider, redirectTo?: string) => Promise<void>
  resetPassword: (email: string, redirectTo?: string) => Promise<boolean>
}

// Create context with default values
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

// Custom hook to use the auth context
export function useAuthContext() {
  const context = useContext(AuthContext)

  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }

  return context
}

// Utility hook for role-based access control
export function useAuthorized(requiredRole: UserRole | UserRole[]) {
  const { hasRole, isAuthenticated, isLoading } = useAuthContext()

  return {
    isAuthorized: isAuthenticated && hasRole(requiredRole),
    isLoading,
  }
}
