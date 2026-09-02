import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { Auth0SocialAuthService } from '../../../apps/web/src/lib/auth/auth0-social-auth-service'
import * as securityModule from '../../../apps/web/src/lib/security/index'

const TEST_AUTH0_DOMAIN = 'test-domain.auth0.com'
const TEST_AUTH0_CLIENT_ID = 'test-client-id'

type MockAuthMethod = ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>

type MockAuthClient = {
  authorizationCodeGrant: ReturnType<typeof vi.fn>
  refreshTokenGrant: ReturnType<typeof vi.fn>
  oauthToken: ReturnType<typeof vi.fn>
  refreshToken: ReturnType<typeof vi.fn>
  getProfile: MockAuthMethod
}

type MockManagementUsers = {
  link: ReturnType<typeof vi.fn>
  unlink: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
}

type MockManagementClient = {
  linkUsers: ReturnType<typeof vi.fn>
  unlinkUsers: ReturnType<typeof vi.fn>
  getUser: ReturnType<typeof vi.fn>
  users: MockManagementUsers
}

type MockUserInfoClient = {
  getUserInfo: ReturnType<typeof vi.fn>
}

const mockAuthMethods: MockAuthClient = vi.hoisted(() => {
  const authorizationCodeGrant = vi.fn()
  const refreshTokenGrant = vi.fn()
  const getProfile = vi.fn()
  return {
    authorizationCodeGrant,
    refreshTokenGrant,
    oauthToken: authorizationCodeGrant,
    refreshToken: refreshTokenGrant,
    getProfile,
  }
})

const mockUserInfoClient: MockUserInfoClient = vi.hoisted(() => ({
  getUserInfo: vi.fn(),
}))

const mockManagementClient: MockManagementClient = vi.hoisted(() => ({
  linkUsers: vi.fn(),
  unlinkUsers: vi.fn(),
  getUser: vi.fn(),
  users: {
    link: vi.fn(),
    unlink: vi.fn(),
    get: vi.fn(),
  },
}))

// Mock the auth0 module
vi.mock('auth0', () => {
  return {
    AuthenticationClient: vi.fn(function () {
      return {
        oauthToken: mockAuthMethods.oauthToken,
        authorizationCodeGrant: mockAuthMethods.authorizationCodeGrant,
        getProfile: mockAuthMethods.getProfile,
        refreshToken: mockAuthMethods.refreshToken,
        refreshTokenGrant: mockAuthMethods.refreshTokenGrant,
        oauth: {
          authorizationCodeGrant: mockAuthMethods.authorizationCodeGrant,
          refreshTokenGrant: mockAuthMethods.refreshTokenGrant,
        },
      }
    }),
    ManagementClient: vi.fn(function () {
      return {
        users: mockManagementClient.users,
      }
    }),
    UserInfoClient: vi.fn(function () {
      return mockUserInfoClient
    }),
  }
})

// Mock security logging
vi.mock('../../../apps/web/src/lib/security/index', () => {
  return {
    logSecurityEvent: vi.fn(),
    SecurityEventType: {
      LOGIN: 'LOGIN',
      ACCOUNT_LINKED: 'ACCOUNT_LINKED',
      ACCOUNT_UNLINKED: 'ACCOUNT_UNLINKED',
    },
  }
})

// Mock MCP integration
vi.mock('../../../apps/web/src/lib/mcp/phase6-integration', () => {
  return {
    updatePhase6AuthenticationProgress: vi.fn(),
  }
})

describe('Auth0 Social Auth Service', () => {
  let auth0SocialAuth: Auth0SocialAuthService
  let mockAuthClientInstance: MockAuthClient
  let mockManagementClientInstance: MockManagementClient
  let mockUserInfoInstance: MockUserInfoClient

  beforeEach(() => {
    // Set environment variables
    process.env.AUTH0_DOMAIN = TEST_AUTH0_DOMAIN
    process.env.AUTH0_CLIENT_ID = TEST_AUTH0_CLIENT_ID
    process.env.AUTH0_CLIENT_SECRET = 'test-client-secret'
    process.env.AUTH0_MANAGEMENT_CLIENT_ID = 'test-management-client-id'
    process.env.AUTH0_MANAGEMENT_CLIENT_SECRET = 'test-management-client-secret'

    // Create new instance
    auth0SocialAuth = new Auth0SocialAuthService()

    // Get the mock clients
    mockAuthClientInstance = mockAuthMethods
    mockManagementClientInstance = mockManagementClient
    mockUserInfoInstance = mockUserInfoClient
    mockManagementClientInstance.users.link =
      mockManagementClientInstance.linkUsers
    mockManagementClientInstance.users.unlink =
      mockManagementClientInstance.unlinkUsers
    mockManagementClientInstance.users.get =
      mockManagementClientInstance.getUser
    mockUserInfoInstance.getUserInfo = vi.fn(async (accessToken: string) => {
      return {
        data: await mockAuthClientInstance.getProfile({
          access_token: accessToken,
        }),
      }
    })

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

      const secondService = new Auth0SocialAuthService()
      expect(secondService).toBeInstanceOf(Auth0SocialAuthService)
    })
  })

  describe('getAuthorizationUrl', () => {
    it('should generate correct authorization URL', () => {
      const url = auth0SocialAuth.getAuthorizationUrl({
        connection: 'google-oauth2',
        redirectUri: 'https://example.com/callback',
        state: 'test-state',
        scope: 'openid profile email',
      })
      const parsed = new URL(url)
      expect(parsed.origin).toBe(`https://${TEST_AUTH0_DOMAIN}`)
      expect(parsed.pathname).toBe('/authorize')
      expect(parsed.searchParams.get('response_type')).toBe('code')
      expect(parsed.searchParams.get('client_id')).toBe(TEST_AUTH0_CLIENT_ID)
      expect(parsed.searchParams.get('connection')).toBe('google-oauth2')
      expect(parsed.searchParams.get('redirect_uri')).toBe(
        'https://example.com/callback',
      )
      expect(parsed.searchParams.get('scope')).toBe('openid profile email')
      expect(parsed.searchParams.get('state')).toBe('test-state')
    })

    it('should generate URL without optional parameters', () => {
      const url = auth0SocialAuth.getAuthorizationUrl({
        connection: 'facebook',
        redirectUri: 'https://example.com/callback',
      })

      const parsed = new URL(url)
      expect(parsed.origin).toBe(`https://${TEST_AUTH0_DOMAIN}`)
      expect(parsed.pathname).toBe('/authorize')
      expect(parsed.searchParams.get('response_type')).toBe('code')
      expect(parsed.searchParams.get('client_id')).toBe(TEST_AUTH0_CLIENT_ID)
      expect(parsed.searchParams.get('connection')).toBe('facebook')
      expect(parsed.searchParams.get('redirect_uri')).toBe(
        'https://example.com/callback',
      )
      expect(parsed.searchParams.get('scope')).toBe('openid profile email')
    })
  })

  describe('getGoogleAuthorizationUrl', () => {
    it('should generate correct Google authorization URL', () => {
      const url = auth0SocialAuth.getGoogleAuthorizationUrl(
        'https://example.com/callback',
        'test-state',
      )

      const parsed = new URL(url)
      expect(parsed.origin).toBe(`https://${TEST_AUTH0_DOMAIN}`)
      expect(parsed.pathname).toBe('/authorize')
      expect(parsed.searchParams.get('response_type')).toBe('code')
      expect(parsed.searchParams.get('client_id')).toBe(TEST_AUTH0_CLIENT_ID)
      expect(parsed.searchParams.get('connection')).toBe('google-oauth2')
      expect(parsed.searchParams.get('redirect_uri')).toBe(
        'https://example.com/callback',
      )
      expect(parsed.searchParams.get('scope')).toBe('openid profile email')
      expect(parsed.searchParams.get('state')).toBe('test-state')
    })

    it('should generate Google URL without state', () => {
      const url = auth0SocialAuth.getGoogleAuthorizationUrl(
        'https://example.com/callback',
      )

      const parsed = new URL(url)
      expect(parsed.origin).toBe(`https://${TEST_AUTH0_DOMAIN}`)
      expect(parsed.pathname).toBe('/authorize')
      expect(parsed.searchParams.get('response_type')).toBe('code')
      expect(parsed.searchParams.get('client_id')).toBe(TEST_AUTH0_CLIENT_ID)
      expect(parsed.searchParams.get('connection')).toBe('google-oauth2')
      expect(parsed.searchParams.get('redirect_uri')).toBe(
        'https://example.com/callback',
      )
      expect(parsed.searchParams.get('scope')).toBe('openid profile email')
    })
  })

  describe('exchangeCodeForTokens', () => {
    it('should successfully exchange code for tokens', async () => {
      const mockTokenResponse = {
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        id_token: 'id-token-789',
        expires_in: 3600,
        token_type: 'Bearer',
      }

      mockAuthClientInstance.oauthToken.mockResolvedValue({
        data: mockTokenResponse,
      })

      const tokens = await auth0SocialAuth.exchangeCodeForTokens(
        'auth-code-123',
        'https://example.com/callback',
      )

      expect(tokens).toEqual({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        idToken: 'id-token-789',
        expiresIn: 3600,
        tokenType: 'Bearer',
      })

      expect(mockAuthClientInstance.oauthToken).toHaveBeenCalledWith({
        code: 'auth-code-123',
        redirect_uri: 'https://example.com/callback',
      })
    })

    it('should throw error when token exchange fails', async () => {
      mockAuthClientInstance.oauthToken.mockRejectedValue(
        new Error('Invalid authorization code'),
      )

      await expect(
        auth0SocialAuth.exchangeCodeForTokens(
          'invalid-code',
          'https://example.com/callback',
        ),
      ).rejects.toThrow('Token exchange failed: Invalid authorization code')
    })

    it('should throw error when auth client is not initialized', async () => {
      // Clear environment variables to make auth client null
      delete process.env.AUTH0_DOMAIN
      delete process.env.AUTH0_CLIENT_ID
      delete process.env.AUTH0_CLIENT_SECRET

      const authService = new Auth0SocialAuthService()

      await expect(
        authService.exchangeCodeForTokens(
          'auth-code',
          'https://example.com/callback',
        ),
      ).rejects.toThrow('Token exchange failed')
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
        created_at: '2023-01-01T00:00:00Z',
      }

      mockAuthClientInstance.getProfile.mockResolvedValue(mockUserInfo)

      const userInfo = await auth0SocialAuth.getUserInfo('access-token-123')

      expect(userInfo).toMatchObject({
        id: 'google-oauth2|123456789',
        email: 'user@example.com',
        name: 'Test User',
        givenName: 'Test',
        familyName: 'User',
        picture: 'https://example.com/avatar.jpg',
        provider: 'google-oauth2',
        emailVerified: true,
      })
      expect(typeof userInfo.createdAt).toBe('string')
    })

    it('should handle missing user information gracefully', async () => {
      const mockUserInfo = {
        sub: 'facebook|987654321',
        email_verified: false,
      }

      mockAuthClientInstance.getProfile.mockResolvedValue(mockUserInfo)

      const userInfo = await auth0SocialAuth.getUserInfo('access-token-123')

      expect(userInfo).toMatchObject({
        id: 'facebook|987654321',
        email: '',
        name: '',
        provider: 'facebook',
        emailVerified: false,
      })
      expect(typeof userInfo.createdAt).toBe('string')
    })

    it('should throw error when getting user info fails', async () => {
      mockAuthClientInstance.getProfile.mockRejectedValue(
        new Error('Invalid access token'),
      )

      await expect(
        auth0SocialAuth.getUserInfo('invalid-token'),
      ).rejects.toThrow('Failed to get user info: Invalid access token')
    })
  })

  describe('refreshAccessToken', () => {
    it('should successfully refresh access token', async () => {
      const mockTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        id_token: 'new-id-token',
        expires_in: 7200,
        token_type: 'Bearer',
      }

      mockAuthClientInstance.refreshToken.mockResolvedValue({
        data: mockTokenResponse,
      })

      const tokens =
        await auth0SocialAuth.refreshAccessToken('refresh-token-123')

      expect(tokens).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        idToken: 'new-id-token',
        expiresIn: 7200,
        tokenType: 'Bearer',
      })

      expect(mockAuthClientInstance.refreshToken).toHaveBeenCalledWith({
        refresh_token: 'refresh-token-123',
      })
    })

    it('should throw error when token refresh fails', async () => {
      mockAuthClientInstance.refreshToken.mockRejectedValue(
        new Error('Invalid refresh token'),
      )

      await expect(
        auth0SocialAuth.refreshAccessToken('invalid-refresh-token'),
      ).rejects.toThrow('Token refresh failed: Invalid refresh token')
    })
  })

  describe('validateToken', () => {
    it('should return true for valid token', async () => {
      // Mock successful user info retrieval
      mockAuthClientInstance.getProfile.mockResolvedValue({ sub: 'user-123' })

      const isValid = await auth0SocialAuth.validateToken('valid-token')

      expect(isValid).toBe(true)
    })

    it('should return false for invalid token', async () => {
      // Mock failed user info retrieval
      mockAuthClientInstance.getProfile.mockRejectedValue(
        new Error('Invalid token'),
      )

      const isValid = await auth0SocialAuth.validateToken('invalid-token')

      expect(isValid).toBe(false)
    })
  })

  describe('getLogoutUrl', () => {
    it('should generate correct logout URL with all parameters', () => {
      const url = auth0SocialAuth.getLogoutUrl({
        returnTo: 'https://example.com/logout',
        clientId: 'custom-client-id',
      })

      expect(url).toBe(
        `https://${TEST_AUTH0_DOMAIN}/v2/logout?` +
          'returnTo=https%3A%2F%2Fexample.com%2Flogout&' +
          'client_id=custom-client-id',
      )
    })

    it('should generate logout URL with default client ID', () => {
      const url = auth0SocialAuth.getLogoutUrl({
        returnTo: 'https://example.com/logout',
      })

      expect(url).toBe(
        `https://${TEST_AUTH0_DOMAIN}/v2/logout?` +
          'returnTo=https%3A%2F%2Fexample.com%2Flogout&' +
          `client_id=${TEST_AUTH0_CLIENT_ID}`,
      )
    })

    it('should generate logout URL without returnTo', () => {
      const url = auth0SocialAuth.getLogoutUrl({
        clientId: 'custom-client-id',
      })

      expect(url).toBe(
        `https://${TEST_AUTH0_DOMAIN}/v2/logout?` +
          'client_id=custom-client-id',
      )
    })

    it('should generate logout URL with no parameters', () => {
      const url = auth0SocialAuth.getLogoutUrl({})

      expect(url).toBe(
        `https://${TEST_AUTH0_DOMAIN}/v2/logout?client_id=${TEST_AUTH0_CLIENT_ID}`,
      )
    })
  })

  describe('authenticate', () => {
    it('should successfully complete authentication flow', async () => {
      // Mock token exchange
      mockAuthClientInstance.oauthToken.mockResolvedValue({
        data: {
          access_token: 'access-token-123',
          refresh_token: 'refresh-token-456',
          id_token: 'id-token-789',
          expires_in: 3600,
          token_type: 'Bearer',
        },
      })

      // Mock user info
      mockAuthClientInstance.getProfile.mockResolvedValue({
        sub: 'google-oauth2|123456789',
        email: 'user@example.com',
        name: 'Test User',
        email_verified: true,
        created_at: '2023-01-01T00:00:00Z',
      })

      const result = await auth0SocialAuth.authenticate(
        'auth-code-123',
        'https://example.com/callback',
      )

      expect(result).toMatchObject({
        user: {
          id: 'google-oauth2|123456789',
          email: 'user@example.com',
          name: 'Test User',
          givenName: undefined,
          familyName: undefined,
          picture: undefined,
          provider: 'google-oauth2',
          emailVerified: true,
        },
        tokens: {
          accessToken: 'access-token-123',
          refreshToken: 'refresh-token-456',
          idToken: 'id-token-789',
          expiresIn: 3600,
          tokenType: 'Bearer',
        },
      })
      expect(typeof result.user.createdAt).toBe('string')

      // Verify security event was logged
      expect(securityModule.logSecurityEvent).toHaveBeenCalledWith(
        securityModule.SecurityEventType.LOGIN,
        null,
        {
          userId: 'google-oauth2|123456789',
          email: 'user@example.com',
          provider: 'google-oauth2',
          method: 'oauth',
        },
      )
    })

    it('should handle authentication errors', async () => {
      // Mock token exchange failure
      mockAuthClientInstance.oauthToken.mockRejectedValue(
        new Error('Invalid authorization code'),
      )

      await expect(
        auth0SocialAuth.authenticate(
          'invalid-code',
          'https://example.com/callback',
        ),
      ).rejects.toThrow('Token exchange failed: Invalid authorization code')
    })
  })

  describe('linkSocialAccount', () => {
    it('should successfully link social account', async () => {
      mockManagementClientInstance.linkUsers.mockResolvedValue({})

      await auth0SocialAuth.linkSocialAccount(
        'auth0|user123',
        'google-oauth2',
        'access-token-123',
      )

      expect(mockManagementClientInstance.users.link).toHaveBeenCalledWith(
        { id: 'auth0|user123' },
        {
          provider: 'google-oauth2',
          connection_id: 'google-oauth2',
          user_id: 'access-token-123',
        },
      )
    })

    it('should throw error when linking fails', async () => {
      mockManagementClientInstance.users.link.mockRejectedValue(
        new Error('Failed to link account'),
      )

      await expect(
        auth0SocialAuth.linkSocialAccount(
          'auth0|user123',
          'google-oauth2',
          'access-token-123',
        ),
      ).rejects.toThrow('Failed to link social account')
    })

    it('should throw error when management client is not initialized', async () => {
      // Clear management client environment variables
      delete process.env.AUTH0_MANAGEMENT_CLIENT_ID
      delete process.env.AUTH0_MANAGEMENT_CLIENT_SECRET

      const authService = new Auth0SocialAuthService()

      await expect(
        authService.linkSocialAccount(
          'auth0|user123',
          'google-oauth2',
          'access-token-123',
        ),
      ).rejects.toThrow(
        /Auth0 management client not initialized|Failed to link social account/,
      )
    })
  })

  describe('unlinkSocialAccount', () => {
    it('should successfully unlink social account', async () => {
      mockManagementClientInstance.unlinkUsers.mockResolvedValue({})

      await auth0SocialAuth.unlinkSocialAccount(
        'auth0|user123',
        'google-oauth2',
        'provider-user-id-123',
      )

      expect(mockManagementClientInstance.users.unlink).toHaveBeenCalledWith(
        'auth0|user123',
        {
          provider: 'google-oauth2',
          user_id: 'provider-user-id-123',
        },
      )
    })

    it('should throw error when unlinking fails', async () => {
      mockManagementClientInstance.users.unlink.mockRejectedValue(
        new Error('Failed to unlink account'),
      )

      await expect(
        auth0SocialAuth.unlinkSocialAccount(
          'auth0|user123',
          'google-oauth2',
          'provider-user-id-123',
        ),
      ).rejects.toThrow(
        'Failed to unlink social account: Failed to unlink account',
      )
    })
  })

  describe('getUserSocialConnections', () => {
    it('should successfully get user social connections', async () => {
      const mockIdentities = [
        { provider: 'google-oauth2', user_id: '123456789' },
        { provider: 'facebook', user_id: '987654321' },
      ]

      mockManagementClientInstance.users.get.mockResolvedValue({
        data: {
          identities: mockIdentities,
        },
      })

      const connections =
        await auth0SocialAuth.getUserSocialConnections('auth0|user123')

      expect(connections).toEqual(mockIdentities)
      expect(mockManagementClientInstance.users.get).toHaveBeenCalledWith(
        'auth0|user123',
      )
    })

    it('should return empty array when getting connections fails', async () => {
      mockManagementClientInstance.users.get.mockRejectedValue(
        new Error('User not found'),
      )

      const connections =
        await auth0SocialAuth.getUserSocialConnections('auth0|user123')

      expect(connections).toEqual([])
    })

    it('should return empty array when user has no identities', async () => {
      mockManagementClientInstance.users.get.mockResolvedValue({ data: {} })

      const connections =
        await auth0SocialAuth.getUserSocialConnections('auth0|user123')

      expect(connections).toEqual([])
    })
  })
})
