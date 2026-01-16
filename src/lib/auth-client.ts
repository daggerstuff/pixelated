/**
 * Custom Auth Client for Pixelated Empathy
 * Replaces Better-Auth client with a simplified fetch-based implementation
 * that communicates with our Auth0-backed backend API.
 */

export interface User {
  id: string
  email: string
  role: string
  fullName?: string
  avatarUrl?: string
}

export interface Session {
  user: User
  expiresAt: string
  token?: string
}

class AuthClient {
  private _session: Session | null = null
  private _isLoading: boolean = false

  /**
   * Hook-like method for React components (mimicking better-auth useSession)
   */
  useSession() {
    // This is a simplified version. In a real app, this would use React context or a state library.
    return {
      data: this._session,
      isPending: this._isLoading,
      error: null
    }
  }

  /**
   * Get the current session (Promise-based, mimicking better-auth client)
   */
  async getSession() {
    return {
      data: this._session ? {
        session: this._session,
        user: this._session.user
      } : null,
      error: null
    }
  }

  /**
   * Sign in with email and password
   */
  async signInEmail({ email, password, rememberMe }: any) {
    this._isLoading = true
    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe })
      })

      const data = await response.json()

      if (!response.ok) {
        return { error: data.error || 'Login failed' }
      }

      this._session = {
        user: data.user,
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
        token: data.token
      }

      return { data, error: null }
    } catch (error: any) {
      return { error: error.message || 'An unexpected error occurred' }
    } finally {
      this._isLoading = false
    }
  }

  /**
   * Sign up a new user
   */
  async signUpEmail({ email, password, role }: any) {
    this._isLoading = true
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role })
      })

      const data = await response.json()

      if (!response.ok) {
        return { error: data.error || 'Registration failed' }
      }

      return { data, error: null }
    } catch (error: any) {
      return { error: error.message || 'An unexpected error occurred' }
    } finally {
      this._isLoading = false
    }
  }

  /**
   * Sign out the current user
   */
  async signOut() {
    try {
      await fetch('/api/auth/signout', { method: 'POST' })
      this._session = null
      window.location.href = '/login'
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }

  /**
   * Initializing method to be added as a bridge
   */
  get signIn() {
    return {
      email: this.signInEmail.bind(this),
      social: async ({ provider, callbackURL }: any) => {
        // Implementation for social login redirect to Auth0
        console.log(`Social login with ${provider} initiated`)
        window.location.href = `/api/auth/auth0-callback?provider=${provider}&redirect=${callbackURL}`
      }
    }
  }

  /**
   * Mimic better-auth forgetPassword
   */
  async forgetPassword({ email, redirectTo }: any) {
    console.log(`Password reset for ${email} requested, redirect to ${redirectTo}`)
    // This would Normalmente hit another endpoint, e.g., /api/auth/forgot-password
    return { success: true }
  }
}

// Export a singleton instance
export const authClient = new AuthClient()

// Export some types for convenience
export const createAuthClient = () => authClient
