/**
 * Custom Auth Client for Pixelated Empathy
 * Replaces Better-Auth client with a simplified fetch-based implementation
 * that communicates with our Auth0-backed backend API.
 */

import React from 'react';

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
   * Note: In a real React app, you should use a Context Provider to avoid duplicate fetches.
   */
  useSession() {
    const [session, setSession] = React.useState<Session | null>(this._session);
    const [isLoading, setIsLoading] = React.useState(!this._session);

    React.useEffect(() => {
      if (!this._session) {
        void this.getSession().then(({ data }) => {
          if (data?.session) {
            setSession(data.session);
          }
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    }, []);

    return {
      data: session,
      isPending: isLoading,
      error: null
    }
  }

  /**
   * Get the current session (Promise-based, mimicking better-auth client)
   */
  async getSession() {
    if (this._session) {
      return {
        data: {
          session: this._session,
          user: this._session.user
        },
        error: null
      }
    }

    try {
      const response = await fetch('/api/auth/auth0-profile');
      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          this._session = {
            user: {
              id: data.user.id,
              email: data.user.email,
              role: data.user.role,
              fullName: data.user.fullName,
              avatarUrl: data.user.profile?.picture
            },
            expiresAt: new Date(Date.now() + 3600000).toISOString(), // Estimated
            token: 'cookie-based'
          };

          return {
            data: {
              session: this._session,
              user: this._session.user
            },
            error: null
          }
        }
      }
    } catch {
      // Ignore error, just no session
    }

    return {
      data: null,
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
      // Clear cookie
      document.cookie = 'auth-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      document.cookie = 'refresh-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';

      this._session = null
      window.location.href = '/'
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
        // Implementation for social login using server-side flow
        console.log(`Social login with ${provider} initiated`)
        const returnTo = callbackURL || window.location.pathname;
        window.location.href = `/api/auth/login?connection=${provider === 'google' ? 'google-oauth2' : provider}&returnTo=${encodeURIComponent(returnTo)}`
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
