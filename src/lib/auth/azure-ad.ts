import { azureConfig } from '../../config/azure.config'
import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('azure-ad')

export interface AzureADUser {
  id: string
  email: string
  name: string
  givenName?: string
  surname?: string
  jobTitle?: string
  department?: string
  companyName?: string
  userPrincipalName: string
  roles?: string[]
}

export interface AzureADTokens {
  accessToken: string
  refreshToken?: string
  idToken?: string
  expiresAt: number
}

export interface AzureADAuthResult {
  user: AzureADUser
  tokens: AzureADTokens
}

/**
 * Azure AD Authentication Service
 * Handles OAuth2 flow with Azure Active Directory
 */
export class AzureADAuthService {
  private readonly config = azureConfig.auth
  private readonly scopes = ['openid', 'profile', 'email', 'User.Read']

  constructor() {
    if (!this.config.isConfigured()) {
      logger.warn('Azure AD is not properly configured')
    }
  }

  /**
   * Get the authorization URL for Azure AD OAuth2 flow
   */
  getAuthorizationUrl(state?: string, redirectUri?: string): string {
    if (!this.config.isConfigured()) {
      throw new Error('Azure AD is not configured')
    }

    const authConfig = this.config.getOAuthConfig()
    const actualRedirectUri = redirectUri || authConfig.redirectUri

    const params = new URLSearchParams({
      client_id: authConfig.clientId!,
      response_type: 'code',
      redirect_uri: actualRedirectUri,
      scope: this.scopes.join(' '),
      response_mode: 'query',
      ...(state && { state }),
    })

    return `${authConfig.authority}/oauth2/v2.0/authorize?${params.toString()}`
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    code: string,
    redirectUri?: string,
  ): Promise<AzureADTokens> {
    if (!this.config.isConfigured()) {
      throw new Error('Azure AD is not configured')
    }

    const authConfig = this.config.getOAuthConfig()
    const actualRedirectUri = redirectUri || authConfig.redirectUri

    const tokenEndpoint = `${authConfig.authority}/oauth2/v2.0/token`

    const body = new URLSearchParams({
      client_id: authConfig.clientId!,
      client_secret: authConfig.clientSecret!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: actualRedirectUri,
      scope: this.scopes.join(' '),
    })

    try {
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error('Token exchange failed', {
          status: response.status,
          error: errorText,
        })
        throw new Error(`Token exchange failed: ${response.status}`)
      }

      const tokenData = await response.json()

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        idToken: tokenData.id_token,
        expiresAt: Date.now() + tokenData.expires_in * 1000,
      }
    } catch (error: unknown) {
      logger.error('Error exchanging code for tokens', {
        error: error instanceof Error ? String(error) : String(error),
      })
      throw error
    }
  }

  /**
   * Get user information from Microsoft Graph API
   */
  async getUserInfo(accessToken: string): Promise<AzureADUser> {
    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error('Failed to get user info', {
          status: response.status,
          error: errorText,
        })
        throw new Error(`Failed to get user info: ${response.status}`)
      }

      const userData = await response.json()

      return {
        id: userData.id,
        email: userData.mail || userData.userPrincipalName,
        name: userData.displayName,
        givenName: userData.givenName,
        surname: userData.surname,
        jobTitle: userData.jobTitle,
        department: userData.department,
        companyName: userData.companyName,
        userPrincipalName: userData.userPrincipalName,
      }
    } catch (error: unknown) {
      logger.error('Error getting user info', {
        error: error instanceof Error ? String(error) : String(error),
      })
      throw error
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<AzureADTokens> {
    if (!this.config.isConfigured()) {
      throw new Error('Azure AD is not configured')
    }

    const authConfig = this.config.getOAuthConfig()
    const tokenEndpoint = `${authConfig.authority}/oauth2/v2.0/token`

    const body = new URLSearchParams({
      client_id: authConfig.clientId!,
      client_secret: authConfig.clientSecret!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: this.scopes.join(' '),
    })

    try {
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error('Token refresh failed', {
          status: response.status,
          error: errorText,
        })
        throw new Error(`Token refresh failed: ${response.status}`)
      }

      const tokenData = await response.json()

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || refreshToken,
        idToken: tokenData.id_token,
        expiresAt: Date.now() + tokenData.expires_in * 1000,
      }
    } catch (error: unknown) {
      logger.error('Error refreshing token', {
        error: error instanceof Error ? String(error) : String(error),
      })
      throw error
    }
  }

  /**
   * Validate access token
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      return response.ok
    } catch (error: unknown) {
      logger.error('Error validating token', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return false
    }
  }

  /**
   * Get logout URL
   */
  getLogoutUrl(postLogoutRedirectUri?: string): string {
    if (!this.config.isConfigured()) {
      throw new Error('Azure AD is not configured')
    }

    const authConfig = this.config.getOAuthConfig()
    const params = new URLSearchParams()

    if (postLogoutRedirectUri) {
      params.set('post_logout_redirect_uri', postLogoutRedirectUri)
    }

    const queryString = params.toString()
    return `${authConfig.authority}/oauth2/v2.0/logout${queryString ? `?${queryString}` : ''}`
  }

  /**
   * Complete authentication flow
   */
  async authenticate(
    code: string,
    redirectUri?: string,
  ): Promise<AzureADAuthResult> {
    const tokens = await this.exchangeCodeForTokens(code, redirectUri)
    const user = await this.getUserInfo(tokens.accessToken)

    logger.info('Azure AD authentication successful', {
      userId: user.id,
      email: user.email,
    })

    return {
      user,
      tokens,
    }
  }
}

// Export singleton instance
export const azureADAuth = new AzureADAuthService()
export default azureADAuth
