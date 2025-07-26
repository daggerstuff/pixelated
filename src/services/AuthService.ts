import type {
  AuthResponse,
  Provider,
  VerifyOtpParams,
} from '@supabase/supabase-js'
import type { AuthRole } from '../config/auth.config'
import { authConfig } from '../config/auth.config'
import { createAuthAuditLog } from '../lib/auth'
import { supabase } from '../lib/supabase'

/**
 * Authentication service for managing user authentication
 */
export class AuthService {
  private static instance: AuthService
  private loginAttempts = new Map<
    string,
    { count: number; timestamp: number }
  >()

  /**
   * Get the singleton instance of AuthService
   */
  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService()
    }
    return AuthService.instance
  }

  /**
   * Sign in with email and password
   */
  public async signInWithPassword(
    email: string,
    password: string,
    options?: { captchaToken?: string; redirectTo?: string },
  ): Promise<AuthResponse> {
    // Check rate limiting
    this.checkRateLimit(email)

    try {
      const response = await supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          captchaToken: options?.captchaToken,
        },
      })

      if (response.error) {
        this.incrementLoginAttempt(email)
        await this.logAuthEvent('login_failed', email)
      } else {
        this.resetLoginAttempts(email)
        await this.updateLastLogin(response.data.user?.id)
        await this.logAuthEvent('login_success', email, response.data.user?.id)
      }

      return response
    } catch (error) {
      this.incrementLoginAttempt(email)
      await this.logAuthEvent('login_error', email, undefined, {
        error: String(error),
      })
      throw error
    }
  }

  /**
   * Sign in with a third-party provider
   */
  public async signInWithOAuth(
    provider: Provider,
    options?: { redirectTo?: string; scopes?: string },
  ): Promise<{ url: string; provider: Provider; error: Error | null }> {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: options?.redirectTo || authConfig.redirects.afterLogin,
          scopes: options?.scopes,
        },
      })

      if (error) {
        await this.logAuthEvent('oauth_failed', `provider:${provider}`)
      } else {
        await this.logAuthEvent('oauth_initiated', `provider:${provider}`)
      }

      return {
        url: data?.url || '',
        provider,
        error,
      }
    } catch (error) {
      await this.logAuthEvent(
        'oauth_error',
        `provider:${provider}`,
        undefined,
        { error: String(error) },
      )
      throw error
    }
  }

  /**
   * Sign in with a one-time password
   */
  public async verifyOtp(params: VerifyOtpParams): Promise<AuthResponse> {
    // Get identifier from params safely outside try block
    const identifier = 'type' in params ? params.type : 'unknown'

    try {
      const response = await supabase.auth.verifyOtp(params)

      if (response.error) {
        await this.logAuthEvent('otp_verification_failed', identifier)
      } else {
        await this.updateLastLogin(response.data.user?.id)
        await this.logAuthEvent(
          'otp_verification_success',
          identifier,
          response.data.user?.id,
        )
      }

      return response
    } catch (error) {
      await this.logAuthEvent('otp_verification_error', identifier, undefined, {
        error: String(error),
      })
      throw error
    }
  }

  /**
   * Sign out the current user
   */
  public async signOut(): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.signOut()

      if (error) {
        await this.logAuthEvent('logout_failed', '')
      } else {
        await this.logAuthEvent('logout_success', '')
      }

      return { error }
    } catch (error) {
      await this.logAuthEvent('logout_error', '', undefined, {
        error: String(error),
      })
      throw error
    }
  }

  /**
   * Update user profile
   */
  public async updateProfile(
    userId: string,
    profile: {
      fullName?: string
      avatarUrl?: string
      role?: AuthRole
      metadata?: Record<string, unknown>
    },
  ): Promise<{ error: Error | null }> {
    try {
      // Update auth metadata if needed
      if (profile.fullName) {
        await supabase.auth.updateUser({
          data: { full_name: profile.fullName },
        })
      }

      // Update profile in database
      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        full_name: profile.fullName,
        avatar_url: profile.avatarUrl,
        role: profile.role,
        metadata: profile.metadata,
        updated_at: new Date().toISOString(),
      })

      if (error) {
        await this.logAuthEvent('profile_update_failed', '', userId)
        return { error }
      }

      await this.logAuthEvent('profile_updated', '', userId)
      return { error: null }
    } catch (error) {
      await this.logAuthEvent('profile_update_error', '', userId, {
        error: String(error),
      })
      throw error
    }
  }

  /**
   * Send password reset email
   */
  public async resetPassword(
    email: string,
    redirectTo?: string,
  ): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo:
          redirectTo || `${authConfig.redirects.afterLogin}/reset-password`,
      })

      if (error) {
        await this.logAuthEvent('password_reset_failed', email)
      } else {
        await this.logAuthEvent('password_reset_requested', email)
      }

      return { error }
    } catch (error) {
      await this.logAuthEvent('password_reset_error', email, undefined, {
        error: String(error),
      })
      throw error
    }
  }

  /**
   * Create a new user accoun
   */
  public async signUp(
    email: string,
    password: string,
    options?: {
      fullName?: string
      redirectTo?: string
      captchaToken?: string
    },
  ): Promise<AuthResponse> {
    try {
      const response = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: options?.fullName,
          },
          emailRedirectTo:
            options?.redirectTo || authConfig.redirects.afterLogin,
          captchaToken: options?.captchaToken,
        },
      })

      if (response.error) {
        await this.logAuthEvent('signup_failed', email)
      } else {
        // Create initial profile
        await supabase.from('profiles').insert({
          id: response.data.user?.id,
          full_name: options?.fullName,
          email,
          role: authConfig.roles.default,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

        await this.logAuthEvent('signup_success', email, response.data.user?.id)
      }

      return response
    } catch (error) {
      await this.logAuthEvent('signup_error', email, undefined, {
        error: String(error),
      })
      throw error
    }
  }

  /**
   * Check if a user is locked out due to too many login attempts
   */
  private checkRateLimit(identifier: string): void {
    const attempt = this.loginAttempts.get(identifier)

    if (attempt && attempt.count >= authConfig.rateLimit.maxLoginAttempts) {
      // Check if the lockout period has expired
      const now = Date.now()
      const lockoutExpires =
        attempt.timestamp + authConfig.rateLimit.lockoutDuration * 1000

      if (now < lockoutExpires) {
        const secondsRemaining = Math.ceil((lockoutExpires - now) / 1000)
        throw new Error(
          `Too many login attempts. Please try again in ${secondsRemaining} seconds.`,
        )
      } else {
        // Lockout period has expired, reset attempts
        this.resetLoginAttempts(identifier)
      }
    }
  }

  /**
   * Increment login attempt counter for rate limiting
   */
  private incrementLoginAttempt(identifier: string): void {
    const attempt = this.loginAttempts.get(identifier)

    if (attempt) {
      attempt.count += 1
      attempt.timestamp = Date.now()
    } else {
      this.loginAttempts.set(identifier, { count: 1, timestamp: Date.now() })
    }
  }

  /**
   * Reset login attempt counter
   */
  private resetLoginAttempts(identifier: string): void {
    this.loginAttempts.delete(identifier)
  }

  /**
   * Update the last login timestamp for a user
   */
  private async updateLastLogin(userId?: string): Promise<void> {
    if (!userId) {
      return
    }

    try {
      await supabase
        .from('profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', userId)
    } catch (error) {
      console.error('Error updating last login:', error)
    }
  }

  /**
   * Log an authentication even
   */
  private async logAuthEvent(
    action: string,
    identifier: string,
    userId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await createAuthAuditLog({
      userId: userId ?? '',
      action,
      resource: 'auth',
      resourceId: userId || identifier,
      metadata: {
        identifier,
        ...metadata,
      },
    })
  }
}

// Export a singleton instance
export const authService = AuthService.getInstance()

export default authService
