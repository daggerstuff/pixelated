import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Auth0SocialAuthService } from '../../../src/lib/auth/auth0-social-auth-service'

// Mock the auth0 module
vi.mock('auth0', () => {
  return {
    AuthenticationClient: vi.fn().mockImplementation(() => {
      return {
        oauthToken: vi.fn(),
        getProfile: vi.fn(),
        refreshToken: vi.fn()
      }
    }),
    ManagementClient: vi.fn().mockImplementation(() => {
      return {
        linkUsers: vi.fn(),
        unlinkUsers: vi.fn(),
        getUser: vi.fn()
      }
    })
  }
})

// Mock security logging
vi.mock('../../../src/lib/security/index', () => {
  return {
    logSecurityEvent: vi.fn(),
    SecurityEventType: {
      LOGIN: 'LOGIN',
      ACCOUNT_LINKED: 'ACCOUNT_LINKED',
      ACCOUNT_UNLINKED: 'ACCOUNT_UNLINKED'
    }
  }
})

// Mock MCP integration
vi.mock('../../../src/lib/mcp/phase6-integration', () => {
  return {
    updatePhase6AuthenticationProgress: vi.fn()
  }
})

describe('Auth0 Social Auth Service', () => {
  let auth0SocialAuth: Auth0SocialAuthService
  let mockAuthClient: any
  let mockManagementClient: any

  beforeEach(() => {
    // Set environment variables
    process.env.AUTH0_DOMAIN = 'test-domain.auth0.com'
    process.env.AUTH0_CLIENT_ID = 'test-client-id'
    process.env.AUTH0_CLIENT_SECRET = 'test-client-secret'
    process.env.AUTH0_MANAGEMENT_CLIENT_ID = 'test-management-client-id'
    process.env.AUTH0_MANAGEMENT_CLIENT_SECRET = 'test-management-client-secret'

    // Create new instance
    auth0SocialAuth = new Auth0SocialAuthService()

    // Get the mock clients
    const auth0Module = require('auth0')
    mockAuthClient = auth0Module.AuthenticationClient.mock.results[0].value
    mockManagementClient = auth0Module.ManagementClient.mock.results[0].value

    // Reset all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up environment variables
    delete process.env.AUTH0_DOMAIN
    delete process.env.AUTH0_CLIENT_ID
    delete process.env.AUTH0_CLIENT_SECRET
    delete process.env.AUTH0_MANAGEMENT_CLIENT_ID
    delete process.env.AUTH0_MANAGEMENT_CLIENT_SECRET
  })

  describe('constructor', () => {
    it('should create instance when properly configured', () => {
      expect(auth0SocialAuth).toBeInstanceOf(Auth0SocialAuthService)
    })

    it('should throw error when not properly configured', () => {
      // Clear environment variables
      delete process.env.AUTH0_DOMAIN
      delete process.env.AUTH0_CLIENT_ID

      expect(() => new Auth0SocialAuthService()).toThrow('Auth0 is not properly configured')
    })
  })

  describe('getAuthorizationUrl', () => {
    it('should generate correct authorization URL', () => {
      const url = auth0SocialAuth.getAuthorizationUrl({
        connection: 'google-oauth2',
        redirectUri: 'https://example.com/callback',
        state: 'test-state',
        scope: 'openid profile email'
      })

      expect(url).toBe(
        'https://test-domain.auth0.com/authorize?' +
        'response_type=code&' +
        'client_id=test-client-id&' +
        'connection=google-oauth2&' +
        'redirect_uri=https%3A%2F%2Fexample.com%2Fcallback&' +
        'scope=openid%20profile%20email&' +
        'state=test-state'
      )
    })

    it('should generate URL without optional parameters', () => {
      const url = auth0SocialAuth.getAuthorizationUrl({
        connection: 'facebook',
        redirectUri: 'https://example.com/callback'
      })

      expect(url).toBe(
        'https://test-domain.auth0.com/authorize?' +
        'response_type=code&' +
        'client_id=test-client-id&' +
        'connection=facebook&' +
        'redirect_uri=https%3A%2F%2Fexample.com%2Fcallback&' +
        'scope=openid%20profile%20email'
      )
    })
  })

  describe('getGoogleAuthorizationUrl', () => {
    it('should generate correct Google authorization URL', () => {
      const url = auth0SocialAuth.getGoogleAuthorizationUrl('https://example.com/callback', 'test-state')

      expect(url).toBe(
        'https://test-domain.auth0.com/authorize?' +
        'response_type=code&' +
        'client_id=test-client-id&' +
        'connection=google-oauth2&' +
        'redirect_uri=https%3A%2F%2Fexample.com%2Fcallback&' +
        'scope=openid%20profile%20email&' +
        'state=test-state'
      )
    })

    it('should generate Google URL without state', () => {
      const url = auth0SocialAuth.getGoogleAuthorizationUrl('https://example.com/callback')

      expect(url).toBe(
        'https://test-domain.auth0.com/authorize?' +
        'response_type=code&' +
        'client_id=test-client-id&' +
        'connection=google-oauth2&' +
        'redirect_uri=https%3A%2F%2Fexample.com%2Fcallback&' +
        'scope=openid%20profile%20email'
      )
    })
  })

  describe('exchangeCodeForTokens', () => {
    it('should successfully exchange code for tokens', async () => {
      const mockTokenResponse = {
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        id_token: 'id-token-789',
        expires_in: 3600,
        token_type: 'Bearer'
      }

      mockAuthClient.oauthToken.mockResolvedValue(mockTokenResponse)

      const tokens = await auth0SocialAuth.exchangeCodeForTokens('auth-code-123', 'https://example.com/callback')

      expect(tokens).toEqual({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        idToken: 'id-token-789',
        expiresIn: 3600,
        tokenType: 'Bearer'
      })

      expect(mockAuthClient.oauthToken).toHaveBeenCalledWith({
        grant_type: 'authorization_code',
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        code: 'auth-code-123',
        redirect_uri: 'https://example.com/callback'
      })
    })

    it('should throw error when token exchange fails', async () => {
      mockAuthClient.oauthToken.mockRejectedValue(new Error('Invalid authorization code'))

      await expect(auth0SocialAuth.exchangeCodeForTokens('invalid-code', 'https://example.com/callback'))
        .rejects.toThrow('Token exchange failed: Invalid authorization code')
    })

    it('should throw error when auth client is not initialized', async () => {
      // Clear environment variables to make auth client null
      delete process.env.AUTH0_DOMAIN
      delete process.env.AUTH0_CLIENT_ID
      delete process.env.AUTH0_CLIENT_SECRET

      const authService = new Auth0SocialAuthService()

      await expect(authService.exchangeCodeForTokens('auth-code', 'https://example.com/callback'))
        .rejects.toThrow('Auth0 authentication client not initialized')
    })
  })

  describe('getUserInfo', () => {
    it('should successfully get user information', async () => {
      const mockUserInfo = {
        sub: 'google-oauth2|123456789',
        email: 'user@example.com',
        name: 'Test User',
        given_name: 'Test',
        family_name: 'User',
        picture: 'https://example.com/avatar.jpg',
        email_verified: true,
        created_at: '2023-01-01T00:00:00Z'
      }

      mockAuthClient.getProfile.mockResolvedValue(mockUserInfo)

      const userInfo = await auth0SocialAuth.getUserInfo('access-token-123')

      expect(userInfo).toEqual({
        id: 'google-oauth2|123456789',
        email: 'user@example.com',
        name: 'Test User',
        givenName: 'Test',
        familyName: 'User',
        picture: 'https://example.com/avatar.jpg',
        provider: 'google-oauth2',
        emailVerified: true,
        createdAt: '2023-01-01T00:00:00Z'
      })
    })

    it('should handle missing user information gracefully', async () => {
      const mockUserInfo = {
        sub: 'facebook|987654321',
        email_verified: false
      }

      mockAuthClient.getProfile.mockResolvedValue(mockUserInfo)

      const userInfo = await auth0SocialAuth.getUserInfo('access-token-123')

      expect(userInfo).toEqual({
        id: 'facebook|987654321',
        email: '',
        name: '',
        provider: 'facebook',
        emailVerified: false,
        createdAt: expect.any(String) // Will be current timestamp
      })
    })

    it('should throw error when getting user info fails', async () => {
      mockAuthClient.getProfile.mockRejectedValue(new Error('Invalid access token'))

      await expect(auth0SocialAuth.getUserInfo('invalid-token'))
        .rejects.toThrow('Failed to get user info: Invalid access token')
    })
  })

  describe('refreshAccessToken', () => {
    it('should successfully refresh access token', async () => {
      const mockTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        id_token: 'new-id-token',
        expires_in: 7200,
        token_type: 'Bearer'
      }

      mockAuthClient.refreshToken.mockResolvedValue(mockTokenResponse)

      const tokens = await auth0SocialAuth.refreshAccessToken('refresh-token-123')

      expect(tokens).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        idToken: 'new-id-token',
        expiresIn: 7200,
        tokenType: 'Bearer'
      })

      expect(mockAuthClient.refreshToken).toHaveBeenCalledWith({
        refresh_token: 'refresh-token-123'
      })
    })

    it('should throw error when token refresh fails', async () => {
      mockAuthClient.refreshToken.mockRejectedValue(new Error('Invalid refresh token'))

      await expect(auth0SocialAuth.refreshAccessToken('invalid-refresh-token'))
        .rejects.toThrow('Token refresh failed: Invalid refresh token')
    })
  })

  describe('validateToken', () => {
    it('should return true for valid token', async () => {
      // Mock successful user info retrieval
      mockAuthClient.getProfile.mockResolvedValue({ sub: 'user-123' })

      const isValid = await auth0SocialAuth.validateToken('valid-token')

      expect(isValid).toBe(true)
    })

    it('should return false for invalid token', async () => {
      // Mock failed user info retrieval
      mockAuthClient.getProfile.mockRejectedValue(new Error('Invalid token'))

      const isValid = await auth0SocialAuth.validateToken('invalid-token')

      expect(isValid).toBe(false)
    })
  })

  describe('getLogoutUrl', () => {
    it('should generate correct logout URL with all parameters', () => {
      const url = auth0SocialAuth.getLogoutUrl({
        returnTo: 'https://example.com/logout',
        clientId: 'custom-client-id'
      })

      expect(url).toBe(
        'https://test-domain.auth0.com/v2/logout?' +
        'returnTo=https%3A%2F%2Fexample.com%2Flogout&' +
        'client_id=custom-client-id'
      )
    })

    it('should generate logout URL with default client ID', () => {
      const url = auth0SocialAuth.getLogoutUrl({
        returnTo: 'https://example.com/logout'
      })

      expect(url).toBe(
        'https://test-domain.auth0.com/v2/logout?' +
        'returnTo=https%3A%2F%2Fexample.com%2Flogout&' +
        'client_id=test-client-id'
      )
    })

    it('should generate logout URL without returnTo', () => {
      const url = auth0SocialAuth.getLogoutUrl({
        clientId: 'custom-client-id'
      })

      expect(url).toBe(
        'https://test-domain.auth0.com/v2/logout?' +
        'client_id=custom-client-id'
      )
    })

    it('should generate logout URL with no parameters', () => {
      const url = auth0SocialAuth.getLogoutUrl({})

      expect(url).toBe('https://test-domain.auth0.com/v2/logout')
    })
  })

  describe('authenticate', () => {
    it('should successfully complete authentication flow', async () => {
      // Mock token exchange
      mockAuthClient.oauthToken.mockResolvedValue({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        id_token: 'id-token-789',
        expires_in: 3600,
        token_type: 'Bearer'
      })

      // Mock user info
      mockAuthClient.getProfile.mockResolvedValue({
        sub: 'google-oauth2|123456789',
        email: 'user@example.com',
        name: 'Test User',
        email_verified: true,
        created_at: '2023-01-01T00:00:00Z'
      })

      const result = await auth0SocialAuth.authenticate('auth-code-123', 'https://example.com/callback')

      expect(result).toEqual({
        user: {
          id: 'google-oauth2|123456789',
          email: 'user@example.com',
          name: 'Test User',
          provider: 'google-oauth2',
          emailVerified: true,
          createdAt: '2023-01-01T00:00:00Z'
        },
        tokens: {
          accessToken: 'access-token-123',
          refreshToken: 'refresh-token-456',
          idToken: 'id-token-789',
          expiresIn: 3600,
          tokenType: 'Bearer'
        }
      })

      // Verify security event was logged
      const securityModule = require('../../../src/lib/security/index')
      expect(securityModule.logSecurityEvent).toHaveBeenCalledWith(
        securityModule.SecurityEventType.LOGIN,
        {
          userId: 'google-oauth2|123456789',
          email: 'user@example.com',
          provider: 'google-oauth2',
          method: 'oauth'
        }
      )
    })

    it('should handle authentication errors', async () => {
      // Mock token exchange failure
      mockAuthClient.oauthToken.mockRejectedValue(new Error('Invalid authorization code'))

      await expect(auth0SocialAuth.authenticate('invalid-code', 'https://example.com/callback'))
        .rejects.toThrow('Token exchange failed: Invalid authorization code')
    })
  })

  describe('linkSocialAccount', () => {
    it('should successfully link social account', async () => {
      mockManagementClient.linkUsers.mockResolvedValue({})

      await auth0SocialAuth.linkSocialAccount('auth0|user123', 'google-oauth2', 'access-token-123')

      expect(mockManagementClient.linkUsers).toHaveBeenCalledWith(
        { id: 'auth0|user123' },
        {
          provider: 'google-oauth2',
          connection_id: 'google-oauth2',
          user_id: 'access-token-123'
        }
      )
    })

    it('should throw error when linking fails', async () => {
      mockManagementClient.linkUsers.mockRejectedValue(new Error('Failed to link account'))

      await expect(auth0SocialAuth.linkSocialAccount('auth0|user123', 'google-oauth2', 'access-token-123'))
        .rejects.toThrow('Failed to link social account: Failed to link account')
    })

    it('should throw error when management client is not initialized', async () => {
      // Clear management client environment variables
      delete process.env.AUTH0_MANAGEMENT_CLIENT_ID
      delete process.env.AUTH0_MANAGEMENT_CLIENT_SECRET

      const authService = new Auth0SocialAuthService()

      await expect(authService.linkSocialAccount('auth0|user123', 'google-oauth2', 'access-token-123'))
        .rejects.toThrow('Auth0 management client not initialized')
    })
  })

  describe('unlinkSocialAccount', () => {
    it('should successfully unlink social account', async () => {
      mockManagementClient.unlinkUsers.mockResolvedValue({})

      await auth0SocialAuth.unlinkSocialAccount('auth0|user123', 'google-oauth2', 'provider-user-id-123')

      expect(mockManagementClient.unlinkUsers).toHaveBeenCalledWith(
        { id: 'auth0|user123' },
        {
          provider: 'google-oauth2',
          user_id: 'provider-user-id-123'
        }
      )
    })

    it('should throw error when unlinking fails', async () => {
      mockManagementClient.unlinkUsers.mockRejectedValue(new Error('Failed to unlink account'))

      await expect(auth0SocialAuth.unlinkSocialAccount('auth0|user123', 'google-oauth2', 'provider-user-id-123'))
        .rejects.toThrow('Failed to unlink social account: Failed to unlink account')
    })
  })

  describe('getUserSocialConnections', () => {
    it('should successfully get user social connections', async () => {
      const mockIdentities = [
        { provider: 'google-oauth2', user_id: '123456789' },
        { provider: 'facebook', user_id: '987654321' }
      ]

      mockManagementClient.getUser.mockResolvedValue({
        identities: mockIdentities
      })

      const connections = await auth0SocialAuth.getUserSocialConnections('auth0|user123')

      expect(connections).toEqual(mockIdentities)
      expect(mockManagementClient.getUser).toHaveBeenCalledWith({ id: 'auth0|user123' })
    })

    it('should return empty array when getting connections fails', async () => {
      mockManagementClient.getUser.mockRejectedValue(new Error('User not found'))

      const connections = await auth0SocialAuth.getUserSocialConnections('auth0|user123')

      expect(connections).toEqual([])
    })

    it('should return empty array when user has no identities', async () => {
      mockManagementClient.getUser.mockResolvedValue({})

      const connections = await auth0SocialAuth.getUserSocialConnections('auth0|user123')

      expect(connections).toEqual([])
    })
  })
})