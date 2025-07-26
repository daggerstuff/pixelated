import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  azureADAuth,
  type AzureADUser,
  type AzureADAuthResult,
} from './azure-ad'
import { supabaseConfig } from '../../config/supabase.config'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('azure-supabase-integration')

export interface IntegratedUser {
  id: string
  email: string
  name: string
  azureId: string
  supabaseId: string
  roles: string[]
  metadata: {
    azureAD: AzureADUser
    lastLogin: string
    provider: 'azure-ad'
  }
}

export interface AuthSession {
  user: IntegratedUser
  accessToken: string
  refreshToken: string
  expiresAt: number
}

/**
 * Azure AD + Supabase Integration Service
 * Manages authentication flow between Azure AD and Supabase
 */
export class AzureSupabaseIntegration {
  private supabase: SupabaseClient

  constructor() {
    this.supabase = createClient(
      supabaseConfig.url,
      supabaseConfig.serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    )
  }

  /**
   * Authenticate user with Azure AD and create/update Supabase user
   */
  async authenticateWithAzureAD(
    code: string,
    redirectUri?: string,
  ): Promise<AuthSession> {
    try {
      // Authenticate with Azure AD
      const azureResult = await azureADAuth.authenticate(code, redirectUri)

      // Create or update user in Supabase
      const integratedUser = await this.createOrUpdateSupabaseUser(azureResult)

      // Create Supabase session
      const session = await this.createSupabaseSession(
        integratedUser,
        azureResult,
      )

      logger.info('Azure AD + Supabase authentication successful', {
        azureId: azureResult.user.id,
        supabaseId: integratedUser.supabaseId,
        email: integratedUser.email,
      })

      return session
    } catch (error) {
      logger.error('Azure AD + Supabase authentication failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Create or update user in Supabase based on Azure AD user
   */
  private async createOrUpdateSupabaseUser(
    azureResult: AzureADAuthResult,
  ): Promise<IntegratedUser> {
    const { user: azureUser } = azureResult

    try {
      // Check if user already exists in Supabase
      const { data: existingUser, error: fetchError } = await this.supabase
        .from('users')
        .select('*')
        .eq('azure_id', azureUser.id)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError
      }

      const userData = {
        email: azureUser.email,
        name: azureUser.name,
        azure_id: azureUser.id,
        metadata: {
          azureAD: azureUser,
          lastLogin: new Date().toISOString(),
          provider: 'azure-ad' as const,
        },
        updated_at: new Date().toISOString(),
      }

      let supabaseUser

      if (existingUser) {
        // Update existing user
        const { data, error } = await this.supabase
          .from('users')
          .update(userData)
          .eq('id', existingUser.id)
          .select()
          .single()

        if (error) {
          throw error
        }
        supabaseUser = data
      } else {
        // Create new user
        const { data, error } = await this.supabase
          .from('users')
          .insert({
            ...userData,
            created_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (error) {
          throw error
        }
        supabaseUser = data
      }

      // Get user roles
      const { data: userRoles } = await this.supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', supabaseUser.id)

      const roles = userRoles?.map((ur) => ur.role) || []

      return {
        id: supabaseUser.id,
        email: supabaseUser.email,
        name: supabaseUser.name,
        azureId: azureUser.id,
        supabaseId: supabaseUser.id,
        roles,
        metadata: supabaseUser.metadata,
      }
    } catch (error) {
      logger.error('Error creating/updating Supabase user', {
        azureId: azureUser.id,
        email: azureUser.email,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Create Supabase session for the integrated user
   */
  private async createSupabaseSession(
    user: IntegratedUser,
    azureResult: AzureADAuthResult,
  ): Promise<AuthSession> {
    try {
      // Create a custom JWT token for Supabase
      const customClaims = {
        sub: user.supabaseId,
        email: user.email,
        azure_id: user.azureId,
        roles: user.roles,
        provider: 'azure-ad',
      }

      // Note: In a real implementation, you would use Supabase's admin API
      // to create a proper session. This is a simplified version.
      const { error } = await this.supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: user.email,
        options: {
          data: customClaims,
        },
      })

      if (error) {
        throw error
      }

      return {
        user,
        accessToken: azureResult.tokens.accessToken,
        refreshToken: azureResult.tokens.refreshToken || '',
        expiresAt: azureResult.tokens.expiresAt,
      }
    } catch (error) {
      logger.error('Error creating Supabase session', {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Refresh authentication session
   */
  async refreshSession(refreshToken: string): Promise<AuthSession> {
    try {
      // Refresh Azure AD token
      const newTokens = await azureADAuth.refreshAccessToken(refreshToken)

      // Get updated user info
      const azureUser = await azureADAuth.getUserInfo(newTokens.accessToken)

      // Update user in Supabase
      const { data: supabaseUser, error } = await this.supabase
        .from('users')
        .update({
          metadata: {
            azureAD: azureUser,
            lastLogin: new Date().toISOString(),
            provider: 'azure-ad',
          },
          updated_at: new Date().toISOString(),
        })
        .eq('azure_id', azureUser.id)
        .select()
        .single()

      if (error) {
        throw error
      }

      // Get user roles
      const { data: userRoles } = await this.supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', supabaseUser.id)

      const roles = userRoles?.map((ur) => ur.role) || []

      const integratedUser: IntegratedUser = {
        id: supabaseUser.id,
        email: supabaseUser.email,
        name: supabaseUser.name,
        azureId: azureUser.id,
        supabaseId: supabaseUser.id,
        roles,
        metadata: supabaseUser.metadata,
      }

      return {
        user: integratedUser,
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken || refreshToken,
        expiresAt: newTokens.expiresAt,
      }
    } catch (error) {
      logger.error('Error refreshing session', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Sign out user from both Azure AD and Supabase
   */
  async signOut(
    userId: string,
    postLogoutRedirectUri?: string,
  ): Promise<string> {
    try {
      // Update last logout in Supabase
      await this.supabase
        .from('users')
        .update({
          metadata: {
            lastLogout: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)

      // Get Azure AD logout URL
      const logoutUrl = azureADAuth.getLogoutUrl(postLogoutRedirectUri)

      logger.info('User signed out', { userId })

      return logoutUrl
    } catch (error) {
      logger.error('Error during sign out', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Get user by Supabase ID
   */
  async getUserById(userId: string): Promise<IntegratedUser | null> {
    try {
      const { data: user, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null
        }
        throw error
      }

      // Get user roles
      const { data: userRoles } = await this.supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)

      const roles = userRoles?.map((ur) => ur.role) || []

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        azureId: user.azure_id,
        supabaseId: user.id,
        roles,
        metadata: user.metadata,
      }
    } catch (error) {
      logger.error('Error getting user by ID', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  /**
   * Validate session
   */
  async validateSession(accessToken: string): Promise<boolean> {
    return await azureADAuth.validateToken(accessToken)
  }
}

// Export singleton instance
export const azureSupabaseIntegration = new AzureSupabaseIntegration()
export default azureSupabaseIntegration
