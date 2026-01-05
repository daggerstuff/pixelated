/**
 * Auth0 Social Authentication Service
 * Handles OAuth2 flow with Auth0 for social providers like Google
 */

import { AuthenticationClient, ManagementClient } from 'auth0'
import { logSecurityEvent, SecurityEventType } from '../security/index'
import { updatePhase6AuthenticationProgress } from '../mcp/phase6-integration'

// Auth0 Configuration
const AUTH0_CONFIG = {
  domain: process.env.AUTH0_DOMAIN || '',
  clientId: process.env.AUTH0_CLIENT_ID || '',
  clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
  managementClientId: process.env.AUTH0_MANAGEMENT_CLIENT_ID || '',
  managementClientSecret: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET || '',
}

// Initialize Auth0 clients
let auth0Authentication: AuthenticationClient | null = null
let auth0Management: ManagementClient | null = null

/**
 * Initialize Auth0 clients
 */
function initializeAuth0Clients() {
  if (!AUTH0_CONFIG.domain || !AUTH0_CONFIG.clientId || !AUTH0_CONFIG.clientSecret) {
    throw new Error('Auth0 configuration is incomplete. Please check environment variables.')
  }

  if (!auth0Authentication) {
    auth0Authentication = new AuthenticationClient({
      domain: AUTH0_CONFIG.domain,
      clientId: AUTH0_CONFIG.clientId,
      clientSecret: AUTH0_CONFIG.clientSecret
    })
  }

  if (!auth0Management && AUTH0_CONFIG.managementClientId && AUTH0_CONFIG.managementClientSecret) {
    auth0Management = new ManagementClient({
      domain: AUTH0_CONFIG.domain,
      clientId: AUTH0_CONFIG.managementClientId,
      clientSecret: AUTH0_CONFIG.managementClientSecret,
      audience: `https://${AUTH0_CONFIG.domain}/api/v2/`,
      scope: 'read:users update:users create:users'
    })
  }
}

// Initialize the clients
initializeAuth0Clients()

// Types
export interface SocialUser {
  id: string
  email: string
  name: string
  givenName?: string
  familyName?: string
  picture?: string
  provider: string
  emailVerified: boolean
  createdAt: string
}

export interface SocialTokens {
  accessToken: string
  refreshToken?: string
  idToken?: string
  expiresIn: number
  tokenType: string
}

export interface SocialAuthResult {
  user: SocialUser
  tokens: SocialTokens
}

/**
 * Auth0 Social Authentication Service
 * Handles OAuth2 flow with Auth0 for social providers
 */
export class Auth0SocialAuthService {
  private readonly domain = AUTH0_CONFIG.domain
  private readonly clientId = AUTH0_CONFIG.clientId

  constructor() {
    if (!this.domain || !this.clientId) {
      throw new Error('Auth0 is not properly configured')
    }
  }

  /**
   * Get the authorization URL for Auth0 OAuth2 flow
   */
  getAuthorizationUrl(params: {
    connection: string
    redirectUri: string
    state?: string
    scope?: string
    audience?: string
  }): string {
    const {
      connection,
      redirectUri,
      state,
      scope = 'openid profile email',
      audience
    } = params

    const authUrl = `https://${this.domain}/authorize`

    const urlParams = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      connection,
      redirect_uri: redirectUri,
      scope,
      ...(state && { state }),
      ...(audience && { audience })
    })

    return `${authUrl}?${urlParams.toString()}`
  }

  /**
   * Get Google OAuth authorization URL
   */
  getGoogleAuthorizationUrl(redirectUri: string, state?: string): string {
    return this.getAuthorizationUrl({
      connection: 'google-oauth2',
      redirectUri,
      state,
      scope: 'openid profile email'
    })
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    code: string,
    redirectUri: string
  ): Promise<SocialTokens> {
    if (!auth0Authentication) {
      throw new Error('Auth0 authentication client not initialized')
    }

    try {
      const tokenResponse = await auth0Authentication.oauthToken({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: AUTH0_CONFIG.clientSecret,
        code,
        redirect_uri: redirectUri
      })

      return {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        idToken: tokenResponse.id_token,
        expiresIn: tokenResponse.expires_in,
        tokenType: tokenResponse.token_type
      }
    } catch (error) {
      console.error('Token exchange failed:', error)
      throw new Error(`Token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get user information from Auth0
   */
  async getUserInfo(accessToken: string): Promise<SocialUser> {
    if (!auth0Authentication) {
      throw new Error('Auth0 authentication client not initialized')
    }

    try {
      const userInfo = await auth0Authentication.getProfile(accessToken)

      return {
        id: userInfo.sub || '',
        email: userInfo.email || '',
        name: userInfo.name || '',
        givenName: userInfo.given_name,
        familyName: userInfo.family_name,
        picture: userInfo.picture,
        provider: userInfo.sub?.split('|')[0] || 'unknown',
        emailVerified: userInfo.email_verified || false,
        createdAt: userInfo.created_at || new Date().toISOString()
      }
    } catch (error) {
      console.error('Failed to get user info:', error)
      throw new Error(`Failed to get user info: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<SocialTokens> {
    if (!auth0Authentication) {
      throw new Error('Auth0 authentication client not initialized')
    }

    try {
      const tokenResponse = await auth0Authentication.refreshToken({
        refresh_token: refreshToken
      })

      return {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        idToken: tokenResponse.id_token,
        expiresIn: tokenResponse.expires_in,
        tokenType: tokenResponse.token_type
      }
    } catch (error) {
      console.error('Token refresh failed:', error)
      throw new Error(`Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Validate access token
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      await this.getUserInfo(accessToken)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Get logout URL
   */
  getLogoutUrl(params: {
    returnTo?: string
    clientId?: string
  }): string {
    const { returnTo, clientId = this.clientId } = params

    const logoutUrl = `https://${this.domain}/v2/logout`

    const urlParams = new URLSearchParams()

    if (returnTo) {
      urlParams.set('returnTo', returnTo)
    }

    if (clientId) {
      urlParams.set('client_id', clientId)
    }

    const queryString = urlParams.toString()
    return `${logoutUrl}${queryString ? `?${queryString}` : ''}`
  }

  /**
   * Complete authentication flow
   */
  async authenticate(
    code: string,
    redirectUri: string
  ): Promise<SocialAuthResult> {
    // Exchange code for tokens
    const tokens = await this.exchangeCodeForTokens(code, redirectUri)

    // Get user information
    const user = await this.getUserInfo(tokens.accessToken)

    // Log authentication event
    await logSecurityEvent(SecurityEventType.LOGIN, {
      userId: user.id,
      email: user.email,
      provider: user.provider,
      method: 'oauth'
    })

    // Update Phase 6 MCP server with authentication progress
    await updatePhase6AuthenticationProgress(user.id, 'social_auth_completed')

    console.log('Social authentication successful', {
      userId: user.id,
      email: user.email,
      provider: user.provider
    })

    return {
      user,
      tokens
    }
  }

  /**
   * Link social account to existing Auth0 user
   */
  async linkSocialAccount(
    userId: string,
    connection: string,
    accessToken: string
  ): Promise<void> {
    if (!auth0Management) {
      throw new Error('Auth0 management client not initialized')
    }

    try {
      // Link the social account to the user
      await auth0Management.linkUsers(
        { id: userId },
        {
          provider: connection,
          connection_id: connection, // This would need to be the actual connection ID
          user_id: accessToken // This is simplified - in reality, you'd need the social provider's user ID
        }
      )

      // Log the linking event
      await logSecurityEvent(SecurityEventType.ACCOUNT_LINKED, {
        userId: userId,
        provider: connection,
        linkedAt: new Date().toISOString()
      })

      // Update Phase 6 MCP server with account linking progress
      await updatePhase6AuthenticationProgress(userId, `social_account_linked_${connection}`)
    } catch (error) {
      console.error(`Failed to link social account ${connection} to user ${userId}:`, error)
      throw new Error(`Failed to link social account: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Unlink social account from Auth0 user
   */
  async unlinkSocialAccount(
    userId: string,
    connection: string,
    providerUserId: string
  ): Promise<void> {
    if (!auth0Management) {
      throw new Error('Auth0 management client not initialized')
    }

    try {
      // Unlink the social account from the user
      await auth0Management.unlinkUsers(
        { id: userId },
        {
          provider: connection,
          user_id: providerUserId
        }
      )

      // Log the unlinking event
      await logSecurityEvent(SecurityEventType.ACCOUNT_UNLINKED, {
        userId: userId,
        provider: connection,
        unlinkedAt: new Date().toISOString()
      })

      // Update Phase 6 MCP server with account unlinking progress
      await updatePhase6AuthenticationProgress(userId, `social_account_unlinked_${connection}`)
    } catch (error) {
      console.error(`Failed to unlink social account ${connection} from user ${userId}:`, error)
      throw new Error(`Failed to unlink social account: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get user's social connections
   */
  async getUserSocialConnections(userId: string): Promise<any[]> {
    if (!auth0Management) {
      throw new Error('Auth0 management client not initialized')
    }

    try {
      const user = await auth0Management.getUser({ id: userId })
      return user.identities || []
    } catch (error) {
      console.error(`Failed to get social connections for user ${userId}:`, error)
      return []
    }
  }
}

// Export singleton instance
export const auth0SocialAuth = new Auth0SocialAuthService()
export default auth0SocialAuth