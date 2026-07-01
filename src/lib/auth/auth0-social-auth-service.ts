/**
 * Auth0 Social Authentication Service
 * Handles OAuth2 flow with Auth0 for social providers like Google
 */

import { AuthenticationClient, ManagementClient, UserInfoClient } from 'auth0'

import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { updatePhase6AuthenticationProgress } from '../mcp/phase6-integration'
import { logSecurityEvent, SecurityEventType } from '../security/index'
import { auth0Config } from './auth0-config'
const logger = createBuildSafeLogger('auth0-social-auth-service')

const shouldWarnAuth0Configuration = process.env['NODE_ENV'] !== 'test'

type Auth0RuntimeConfig = {
  domain: string
  clientId: string
  clientSecret: string
  managementClientId: string
  managementClientSecret: string
}

function getFirstDefined(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (value !== undefined) {
      return value
    }
  }

  return ''
}

function getAuth0RuntimeConfig(): Auth0RuntimeConfig {
  return {
    domain: getFirstDefined(
      process.env['AUTH0_DOMAIN'],
      process.env['PUBLIC_AUTH0_DOMAIN'],
      auth0Config.domain,
    ),
    clientId: getFirstDefined(
      process.env['AUTH0_CLIENT_ID'],
      process.env['PUBLIC_AUTH0_CLIENT_ID'],
      auth0Config.clientId,
    ),
    clientSecret: getFirstDefined(
      process.env['AUTH0_CLIENT_SECRET'],
      auth0Config.clientSecret,
    ),
    managementClientId: getFirstDefined(
      process.env['AUTH0_MANAGEMENT_CLIENT_ID'],
      auth0Config.managementClientId,
    ),
    managementClientSecret: getFirstDefined(
      process.env['AUTH0_MANAGEMENT_CLIENT_SECRET'],
      auth0Config.managementClientSecret,
    ),
  }
}

// Initialize Auth0 clients
let auth0Authentication: AuthenticationClient | null = null
let auth0Management: ManagementClient | null = null
let auth0UserInfo: UserInfoClient | null = null

/**
 * Initialize Auth0 clients
 */
function initializeAuth0Clients() {
  const AUTH0_CONFIG = getAuth0RuntimeConfig()
  if (
    !AUTH0_CONFIG.domain ||
    !AUTH0_CONFIG.clientId ||
    !AUTH0_CONFIG.clientSecret
  ) {
    if (shouldWarnAuth0Configuration) {
      logger.warn('Auth0 configuration incomplete')
    }
    return
  }

  auth0Authentication = new AuthenticationClient({
    domain: AUTH0_CONFIG.domain,
    clientId: AUTH0_CONFIG.clientId,
    clientSecret: AUTH0_CONFIG.clientSecret,
  })

  auth0UserInfo = new UserInfoClient({
    domain: AUTH0_CONFIG.domain,
  })

  if (AUTH0_CONFIG.managementClientId && AUTH0_CONFIG.managementClientSecret) {
    auth0Management = new ManagementClient({
      domain: AUTH0_CONFIG.domain,
      clientId: AUTH0_CONFIG.managementClientId,
      clientSecret: AUTH0_CONFIG.managementClientSecret,
      audience: `https://${AUTH0_CONFIG.domain}/api/v2/`,
    })
  } else {
    auth0Management = null
  }
}

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
  private readonly domain: string
  private readonly clientId: string

  constructor() {
    const config = getAuth0RuntimeConfig()
    this.domain = config.domain
    this.clientId = config.clientId

    if (!this.domain || !this.clientId) {
      if (shouldWarnAuth0Configuration) {
        logger.warn('Auth0 is not properly configured')
      }
    }
    initializeAuth0Clients()
  }

  /**
   * Get the authorization URL for Auth0 OAuth2 flow
   */
  getAuthorizationUrl(params: {
    connection?: string
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
      audience,
    } = params

    const authUrl = `https://${this.domain}/authorize`

    const urlParams = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope,
      ...(connection && { connection }),
      ...(state && { state }),
      ...(audience && { audience }),
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
      scope: 'openid profile email',
    })
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
  ): Promise<SocialTokens> {
    if (!auth0Authentication) {
      throw new Error('Auth0 authentication client not initialized')
    }

    try {
      const response = await auth0Authentication.oauth.authorizationCodeGrant({
        code,
        redirect_uri: redirectUri,
      })
      const data = response.data

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        idToken: data.id_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type,
      }
    } catch (error: unknown) {
      logger.error('Token exchange failed:', error)
      throw new Error(
        `Token exchange failed: ${error instanceof Error ? (error instanceof Error ? error.message : 'Unknown error') : 'Unknown error'}`,
      )
    }
  }

  /**
   * Get user information from Auth0
   */
  async getUserInfo(accessToken: string): Promise<SocialUser> {
    if (!auth0UserInfo) {
      throw new Error('Auth0 user info client not initialized')
    }

    try {
      const response = await auth0UserInfo.getUserInfo(accessToken)
      const userInfo = response.data

      return {
        id: userInfo.sub ?? '',
        email: userInfo.email ?? '',
        name: userInfo.name ?? '',
        givenName: userInfo.given_name,
        familyName: userInfo.family_name,
        picture: userInfo.picture,
        provider: userInfo.sub?.split('|')[0] ?? 'unknown',
        emailVerified: userInfo.email_verified ?? false,
        createdAt: new Date().toISOString(),
      }
    } catch (error: unknown) {
      logger.error('Failed to get user info:', error)
      throw new Error(
        `Failed to get user info: ${error instanceof Error ? (error instanceof Error ? error.message : 'Unknown error') : 'Unknown error'}`,
      )
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
      const response = await auth0Authentication.oauth.refreshTokenGrant({
        refresh_token: refreshToken,
      })
      const data = response.data

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        idToken: data.id_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type,
      }
    } catch (error: unknown) {
      logger.error('Token refresh failed:', error)
      throw new Error(
        `Token refresh failed: ${error instanceof Error ? (error instanceof Error ? error.message : 'Unknown error') : 'Unknown error'}`,
      )
    }
  }

  /**
   * Validate access token
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      await this.getUserInfo(accessToken)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get logout URL
   */
  getLogoutUrl(params: { returnTo?: string; clientId?: string }): string {
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
    redirectUri: string,
  ): Promise<SocialAuthResult> {
    // Exchange code for tokens
    const tokens = await this.exchangeCodeForTokens(code, redirectUri)

    // Get user information
    const user = await this.getUserInfo(tokens.accessToken)

    // Log authentication event
    logSecurityEvent(SecurityEventType.LOGIN, null, {
      userId: user.id,
      email: user.email,
      provider: user.provider,
      method: 'oauth',
    })

    // Update Phase 6 MCP server with authentication progress
    await updatePhase6AuthenticationProgress(user.id, 'login_success')

    logger.info('Social authentication successful', {
      userId: user.id,
      email: user.email,
      provider: user.provider,
    })

    return {
      user,
      tokens,
    }
  }

  /**
   * Link social account to existing Auth0 user
   */
  async linkSocialAccount(
    userId: string,
    connection: string,
    accessToken: string,
  ): Promise<void> {
    if (!auth0Management) {
      throw new Error('Auth0 management client not initialized')
    }

    try {
      // Link the social account to the user
      await auth0Management.users.link(
        {
          id: userId,
        },
        {
          provider: connection,
          connection_id: connection,
          user_id: accessToken,
        },
      )

      // Log the linking event
      logSecurityEvent(SecurityEventType.ACCOUNT_LINKED, null, {
        userId: userId,
        provider: connection,
        linkedAt: new Date().toISOString(),
      })

      // Update Phase 6 MCP server with account linking progress
      await updatePhase6AuthenticationProgress(
        userId,
        `social_account_linked_${connection}`,
      )
    } catch (error: unknown) {
      logger.error(
        `Failed to link social account ${connection} to user ${userId}:`,
        error,
      )
      throw new Error(
        `Failed to link social account: ${error instanceof Error ? (error instanceof Error ? error.message : 'Unknown error') : 'Unknown error'}`,
      )
    }
  }

  /**
   * Unlink social account from Auth0 user
   */
  async unlinkSocialAccount(
    userId: string,
    connection: string,
    providerUserId: string,
  ): Promise<void> {
    if (!auth0Management) {
      throw new Error('Auth0 management client not initialized')
    }

    try {
      // Unlink the social account from the user
      await auth0Management.users.unlink(userId, {
        provider: connection,
        user_id: providerUserId,
      })

      // Log the unlinking event
      logSecurityEvent(SecurityEventType.ACCOUNT_UNLINKED, null, {
        userId: userId,
        provider: connection,
        unlinkedAt: new Date().toISOString(),
      })

      // Update Phase 6 MCP server with account unlinking progress
      await updatePhase6AuthenticationProgress(
        userId,
        `social_account_unlinked_${connection}`,
      )
    } catch (error: unknown) {
      logger.error(
        `Failed to unlink social account ${connection} from user ${userId}:`,
        error,
      )
      throw new Error(
        `Failed to unlink social account: ${error instanceof Error ? (error instanceof Error ? error.message : 'Unknown error') : 'Unknown error'}`,
      )
    }
  }

  /**
   * Get user's social connections
   */
  async getUserSocialConnections(userId: string): Promise<unknown[]> {
    if (!auth0Management) {
      throw new Error('Auth0 management client not initialized')
    }

    try {
      const response = await auth0Management.users.get(userId)
      const user = response.data
      if (
        typeof user === 'object' &&
        'identities' in user &&
        Array.isArray(user.identities)
      ) {
        return user.identities
      }
      return []
    } catch (error: unknown) {
      logger.error(
        `Failed to get social connections for user ${userId}:`,
        error,
      )
      return []
    }
  }
}

// Export singleton instance
export const auth0SocialAuth = new Auth0SocialAuthService()
export default auth0SocialAuth
