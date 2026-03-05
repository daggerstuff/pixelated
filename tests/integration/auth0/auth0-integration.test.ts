/// <reference types="vitest/globals" />
/**
 * Integration Tests for Auth0 Authentication Flows
 *
 * These tests verify the complete authentication workflows including:
 * - Email/password authentication
 * - Social authentication (Google OAuth)
 * - JWT token validation and refresh
 * - Role-based access control
 * - Security features and logging
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
// Static imports removed to allow dynamic loading with env vars
// import { Auth0UserService } from '../../../src/services/auth0.service'
// import { Auth0SocialAuthService } from '../../../src/lib/auth/auth0-social-auth-service'
// import * as auth0JwtService from '../../../src/lib/auth/auth0-jwt-service'
// import * as auth0RbacService from '../../../src/lib/auth/auth0-rbac-service'

// Define mock instances at top level to ensure tests configure the same objects used by the service
const mockAuthenticationClient = {
  passwordGrant: vi.fn(),
  getProfile: vi.fn(),
  oauthToken: vi.fn(),
  refreshToken: vi.fn(),
  revoke: vi.fn()
}

const mockManagementClient = {
  createUser: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  getUsers: vi.fn(),
  assignRolestoUser: vi.fn(),
  getUserRoles: vi.fn(),
  getUserPermissions: vi.fn(),
  linkUsers: vi.fn(),
  createPasswordChangeTicket: vi.fn(),
  unlinkUsers: vi.fn(),
  getRoles: vi.fn(),
  getPermissions: vi.fn(),
  removeRolesFromUser: vi.fn(),
  addPermissionsInRole: vi.fn()
}

// Mock the auth0 module
vi.mock('auth0', () => {
  return {
    AuthenticationClient: vi.fn(function() { return mockAuthenticationClient }),
    ManagementClient: vi.fn(function() { return mockManagementClient })
  }
})

// Mock the mongodb config
vi.mock('../../../src/config/mongodb.config', () => {
  return {
    mongodb: {
      connect: vi.fn().mockResolvedValue({
        collection: vi.fn().mockReturnValue({
          findOne: vi.fn(),
          insertOne: vi.fn(),
          updateOne: vi.fn()
        })
      })
    }
  }
})

// Mock redis functions
vi.mock('../../../src/lib/redis', () => {
  return {
    getFromCache: vi.fn(),
    setInCache: vi.fn(),
    removeFromCache: vi.fn()
  }
})

// Mock security logging
vi.mock('../../../src/lib/security/index', () => {
  return {
    logSecurityEvent: vi.fn(),
    SecurityEventType: {
      LOGIN: 'LOGIN',
      ACCOUNT_LINKED: 'ACCOUNT_LINKED',
      ACCOUNT_UNLINKED: 'ACCOUNT_UNLINKED',
      TOKEN_VALIDATED: 'TOKEN_VALIDATED',
      TOKEN_VALIDATION_FAILED: 'TOKEN_VALIDATION_FAILED',
      TOKEN_REFRESHED: 'TOKEN_REFRESHED',
      TOKEN_REVOKED: 'TOKEN_REVOKED',
      ROLE_ASSIGNED: 'ROLE_ASSIGNED',
      ROLE_REMOVED: 'ROLE_REMOVED'
    }
  }
})

// Mock MCP integration
vi.mock('../../../src/lib/mcp/phase6-integration', () => {
  return {
    updatePhase6AuthenticationProgress: vi.fn()
  }
})

describe('Auth0 Integration Tests', () => {
  let auth0UserService: any
  let auth0SocialAuthService: any

  // Classes and modules loaded dynamically
  let Auth0UserServiceClass: any
  let Auth0SocialAuthServiceClass: any
  let auth0JwtService: any
  let auth0RbacService: any

  beforeAll(async () => {
    // Setup environment variables using stubEnv
    vi.stubEnv('AUTH0_DOMAIN', 'test-domain.auth0.com')
    vi.stubEnv('AUTH0_CLIENT_ID', 'test-client-id')
    vi.stubEnv('AUTH0_CLIENT_SECRET', 'test-client-secret')
    vi.stubEnv('AUTH0_AUDIENCE', 'https://api.pixelatedempathy.com')
    vi.stubEnv('AUTH0_MANAGEMENT_CLIENT_ID', 'test-mgmt-id')
    vi.stubEnv('AUTH0_MANAGEMENT_CLIENT_SECRET', 'test-mgmt-secret')

    // Reset modules to reload services with new env vars
    vi.resetModules()

    // Dynamic imports
    const auth0ServiceMod = await import('../../../src/services/auth0.service')
    Auth0UserServiceClass = auth0ServiceMod.Auth0UserService

    const socialAuthMod = await import('../../../src/lib/auth/auth0-social-auth-service')
    Auth0SocialAuthServiceClass = socialAuthMod.Auth0SocialAuthService

    auth0JwtService = await import('../../../src/lib/auth/auth0-jwt-service')
    auth0RbacService = await import('../../../src/lib/auth/auth0-rbac-service')
  })

  afterAll(() => {
    // Clean up environment variables
    delete process.env.AUTH0_DOMAIN
    delete process.env.AUTH0_CLIENT_ID
    delete process.env.AUTH0_CLIENT_SECRET
    delete process.env.AUTH0_AUDIENCE
    delete process.env.AUTH0_MANAGEMENT_CLIENT_ID
    delete process.env.AUTH0_MANAGEMENT_CLIENT_SECRET
  })

  beforeEach(() => {
    // Create new instances
    auth0UserService = new Auth0UserServiceClass()
    auth0SocialAuthService = new Auth0SocialAuthServiceClass()

    // Reset all mocks
    vi.clearAllMocks()
  })

  describe('Email/Password Authentication Flow', () => {
    it('should successfully authenticate user with valid credentials', async () => {
      const mockTokenResponse = {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3Rlc3QtZG9tYWluLmF1dGgwLmNvbS8iLCJzdWIiOiJhdXRoMHwxMjM0NTYiLCJleHAiOjE5OTk5OTk5OTksImF1ZCI6Imh0dHBzOi8vYXBpLnBpeGVsYXRlZC1lbXBhdGh5LmNvbSJ9.signature',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600
      }

      const mockUserProfile = {
        user_id: 'auth0|123456',
        email: 'test@example.com',
        email_verified: true,
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        created_at: '2023-01-01T00:00:00Z',
        last_login: '2023-01-02T00:00:00Z',
        app_metadata: { roles: ['user'] },
        'https://pixelated.empathy/app_metadata': { roles: ['user'] },
        'https://pixelated.empathy/user_metadata': { role: 'user' },
        user_metadata: { role: 'user' }
      }

      // Mock Auth0 clients
      const mockAuthClient = mockAuthenticationClient
      mockAuthClient.passwordGrant.mockResolvedValue(mockTokenResponse)
      mockAuthClient.getProfile.mockResolvedValue(mockUserProfile)

      const result = await auth0UserService.signIn('test@example.com', 'password123')

      expect(result).toEqual({
        user: {
          id: 'auth0|123456',
          email: 'test@example.com',
          emailVerified: true,
          role: 'user',
          fullName: 'Test User',
          avatarUrl: 'https://example.com/avatar.jpg',
          createdAt: '2023-01-01T00:00:00Z',
          lastLogin: '2023-01-02T00:00:00Z',
          appMetadata: { roles: ['user'] },
          userMetadata: { role: 'user' }
        },
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3Rlc3QtZG9tYWluLmF1dGgwLmNvbS8iLCJzdWIiOiJhdXRoMHwxMjM0NTYiLCJleHAiOjE5OTk5OTk5OTksImF1ZCI6Imh0dHBzOi8vYXBpLnBpeGVsYXRlZC1lbXBhdGh5LmNvbSJ9.signature',
        refreshToken: 'mock-refresh-token'
      })

      expect(mockAuthClient.passwordGrant).toHaveBeenCalledWith({
        username: 'test@example.com',
        password: 'password123',
        realm: 'Username-Password-Authentication',
        scope: 'openid profile email',
        audience: 'https://api.pixelatedempathy.com'
      })

      // Verify security event was logged
      const securityModule = await import('../../../src/lib/security/index')
      expect(securityModule.logSecurityEvent).toHaveBeenCalledWith(
        securityModule.SecurityEventType.LOGIN,
        {
          userId: 'auth0|123456',
          email: 'test@example.com',
          method: 'password'
        }
      )
    })

    it('should reject authentication with invalid credentials', async () => {
      const mockAuthClient = mockAuthenticationClient
      mockAuthClient.passwordGrant.mockRejectedValue(new Error('Unauthorized'))

      await expect(auth0UserService.signIn('test@example.com', 'wrongpassword'))
        .rejects.toThrow('Invalid credentials')
    })

    it('should create new user account', async () => {
      const mockAuth0User = {
        user_id: 'auth0|123456',
        email: 'newuser@example.com',
        email_verified: false,
        name: null,
        picture: null,
        created_at: '2023-01-01T00:00:00Z',
        app_metadata: { roles: ['User'] },
        user_metadata: { role: 'user', created_at: '2023-01-01T00:00:00Z' }
      }


      mockManagementClient.createUser.mockResolvedValue(mockAuth0User)

      const result = await auth0UserService.createUser('newuser@example.com', 'password123', 'user')

      expect(result).toEqual({
        id: 'auth0|123456',
        email: 'newuser@example.com',
        emailVerified: false,
        role: 'user',
        fullName: null,
        avatarUrl: null,
        createdAt: '2023-01-01T00:00:00Z',
        appMetadata: { roles: ['User'] },
        userMetadata: { role: 'user', created_at: '2023-01-01T00:00:00Z' }
      })

      expect(mockManagementClient.createUser).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        password: 'password123',
        connection: 'Username-Password-Authentication',
        email_verified: false,
        app_metadata: {
          roles: ['User'],
          imported_from: 'manual_creation'
        },
        user_metadata: {
          role: 'user',
          created_at: expect.any(String)
        }
      })
    })
  })

  describe('Social Authentication Flow', () => {
    it('should generate correct Google authorization URL', () => {
      const url = auth0SocialAuthService.getGoogleAuthorizationUrl('https://example.com/callback', 'test-state')

      expect(url).toBe(
        'https://test-domain.auth0.com/authorize?' +
        'response_type=code&' +
        'client_id=test-client-id&' +
        'connection=google-oauth2&' +
        'redirect_uri=https%3A%2F%2Fexample.com%2Fcallback&' +
        'scope=openid+profile+email&' +
        'state=test-state'
      )
    })

    it('should successfully exchange authorization code for tokens', async () => {
      const mockTokenResponse = {
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        id_token: 'id-token-789',
        expires_in: 3600,
        token_type: 'Bearer'
      }

      const mockAuthClient = mockAuthenticationClient
      mockAuthClient.oauthToken.mockResolvedValue(mockTokenResponse)

      const tokens = await auth0SocialAuthService.exchangeCodeForTokens('auth-code-123', 'https://example.com/callback')

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

    it('should successfully get user information from access token', async () => {
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

      const mockAuthClient = mockAuthenticationClient
      mockAuthClient.getProfile.mockResolvedValue(mockUserInfo)

      const userInfo = await auth0SocialAuthService.getUserInfo('access-token-123')

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

    it('should complete full authentication flow', async () => {
      // Mock token exchange
      const mockAuthClient = mockAuthenticationClient
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

      const result = await auth0SocialAuthService.authenticate('auth-code-123', 'https://example.com/callback')

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
      const securityModule = await import('../../../src/lib/security/index')
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
  })

  describe('JWT Token Validation and Refresh', () => {
    it('should validate a valid access token', async () => {
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhdXRoMHwxMjM0NTYiLCJpc3MiOiJodHRwczovL3Rlc3QtZG9tYWluLmF1dGgwLmNvbS8iLCJhdWQiOiJodHRwczovL2FwaS5waXhlbGF0ZWQtZW1wYXRoeS5jb20iLCJleHAiOjk5OTk5OTk5OTksImlhdCI6MTYxNjIzOTAyMn0.signature'

      const mockPayload = {
        sub: 'auth0|123456',
        iss: 'https://test-domain.auth0.com/',
        aud: 'https://api.pixelatedempathy.com',
        exp: 9999999999,
        'https://pixelated.empathy/app_metadata': { roles: ['admin'] }
      }

      const mockAuthClient = mockAuthenticationClient
      mockAuthClient.getProfile.mockResolvedValue(mockPayload)

      const result = await auth0JwtService.validateToken(validToken, 'access')

      expect(result).toEqual({
        valid: true,
        userId: 'auth0|123456',
        role: 'admin',
        tokenId: expect.any(String),
        expiresAt: 9999999999,
        payload: expect.objectContaining({
          sub: 'auth0|123456'
        })
      })

      expect(mockAuthClient.getProfile).toHaveBeenCalledWith(validToken)
    })

    it('should reject an expired token', async () => {
      // Expired token (exp: 1516239022)
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhdXRoMHwxMjM0NTYiLCJpc3MiOiJodHRwczovL3Rlc3QtZG9tYWluLmF1dGgwLmNvbS8iLCJhdWQiOiJodHRwczovL2FwaS5waXhlbGF0ZWQtZW1wYXRoeS5jb20iLCJleHAiOjE1MTYyMzkwMjJ9.signature'

      const mockPayload = {
        sub: 'auth0|123456',
        iss: 'https://test-domain.auth0.com/',
        aud: 'https://api.pixelatedempathy.com',
        exp: 1516239022
      }

      const mockAuthClient = mockAuthenticationClient
      mockAuthClient.getProfile.mockResolvedValue(mockPayload)

      const result = await auth0JwtService.validateToken(expiredToken, 'access')

      expect(result).toEqual({
        valid: false,
        error: 'Token has expired'
      })
    })

    it('should successfully refresh access token', async () => {
      const mockTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer'
      }

      const mockUserResponse = {
        sub: 'auth0|123456',
        jti: 'new-token-id-456',
        'https://pixelated.empathy/app_metadata': { roles: ['user'] }
      }

      const mockAuthClient = mockAuthenticationClient
      mockAuthClient.refreshToken.mockResolvedValue(mockTokenResponse)
      mockAuthClient.getProfile.mockResolvedValue(mockUserResponse)

      const result = await auth0JwtService.refreshAccessToken('old-refresh-token', {
        ip: '127.0.0.1',
        userAgent: 'test-agent'
      })

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: {
          id: 'auth0|123456',
          role: 'user'
        }
      })

      expect(mockAuthClient.refreshToken).toHaveBeenCalledWith({
        refresh_token: 'old-refresh-token'
      })
    })

    it('should revoke token successfully', async () => {
      const redisModule = await import('../../../src/lib/redis')
      redisModule.setInCache.mockResolvedValue(undefined)

      await auth0JwtService.revokeToken('token-to-revoke', 'user_logout')

      expect(redisModule.setInCache).toHaveBeenCalledWith(
        'revoked:token-to-revoke',
        { reason: 'user_logout', revokedAt: expect.any(Number) },
        24 * 60 * 60
      )
    })
  })

  describe('Role-Based Access Control', () => {
    it('should assign role to user', async () => {


      // Mock role lookup
      mockManagementClient.getRoles.mockResolvedValue([{
        id: 'role-id-123',
        name: 'therapist'
      }])

      // Mock role assignment
      mockManagementClient.assignRolestoUser.mockResolvedValue({})

      await auth0RbacService.assignRoleToUser('auth0|user123', 'therapist')

      expect(mockManagementClient.getRoles).toHaveBeenCalledWith({ name_filter: 'therapist' })
      expect(mockManagementClient.assignRolestoUser).toHaveBeenCalledWith(
        { id: 'auth0|user123' },
        { roles: ['role-id-123'] }
      )

      // Verify security event was logged
      const securityModule = await import('../../../src/lib/security/index')
      expect(securityModule.logSecurityEvent).toHaveBeenCalledWith(
        securityModule.SecurityEventType.ROLE_ASSIGNED,
        {
          userId: 'auth0|user123',
          role: 'therapist',
          assignedBy: 'system'
        }
      )
    })

    it('should check if user has specific role', async () => {
      // Mock getUserRoles to return roles including 'therapist'
      mockManagementClient.getUserRoles.mockResolvedValue([
        { id: 'role-1', name: 'patient' },
        { id: 'role-2', name: 'therapist' }
      ])

      const hasRole = await auth0RbacService.userHasRole('auth0|user123', 'therapist')

      expect(hasRole).toBe(true)
    })

    it('should check if user has specific permission', async () => {
      // Mock getUserRoles to return therapist role
      mockManagementClient.getUserRoles.mockResolvedValue([
        { id: 'role-2', name: 'therapist' }
      ])
      // Mock permissions for the role (if applicable, though userHasPermission might check local mapping or API)
      mockManagementClient.getPermissions.mockResolvedValue([
        { permission_name: 'read:patients' }
      ])

      const hasPermission = await auth0RbacService.userHasPermission('auth0|user123', 'read:patients')

      expect(hasPermission).toBe(true) // therapists have read:patients permission
    })

    it('should get all permissions for user', async () => {
      // Mock getUserRoles to return admin role
      mockManagementClient.getUserRoles.mockResolvedValue([
        { id: 'role-3', name: 'admin' }
      ])
      // Mock permissions for admin
      mockManagementClient.getUserPermissions.mockResolvedValue([
        { permission_name: 'read:patients' },
        { permission_name: 'manage:roles' }
      ])
      // Also ensure getPermissions returns a list if called
      mockManagementClient.getPermissions.mockResolvedValue([
        { permission_name: 'read:patients' },
        { permission_name: 'manage:roles' }
      ])

      const permissions = await auth0RbacService.getUserPermissions('auth0|user123')

      // Admin should have all permissions
      expect(permissions).toContain('read:patients')
      expect(permissions).toContain('manage:roles')
      expect(permissions.length).toBeGreaterThan(1) // Should have permissions
    })

    it('should validate role transition', () => {
      const transition = auth0RbacService.validateRoleTransition('therapist', 'admin')

      expect(transition.fromRole).toBe('therapist')
      expect(transition.toRole).toBe('admin')
      expect(transition.requiresApproval).toBe(false) // Admin doesn't require approval
      expect(transition.requiresMFA).toBe(true) // Upgrading requires MFA
      expect(transition.auditRequired).toBe(true)
    })
  })

  describe('Security Features and Logging', () => {
    it('should log security events for login attempts', async () => {
      const mockTokenResponse = {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3Rlc3QtZG9tYWluLmF1dGgwLmNvbS8iLCJzdWIiOiJhdXRoMHwxMjM0NTYiLCJleHAiOjE5OTk5OTk5OTksImF1ZCI6Imh0dHBzOi8vYXBpLnBpeGVsYXRlZC1lbXBhdGh5LmNvbSJ9.signature',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600
      }

      const mockUserProfile = {
        user_id: 'auth0|123456',
        email: 'test@example.com',
        email_verified: true,
        name: 'Test User',
        app_metadata: { roles: ['User'] }
      }

      // Mock Auth0 clients
      const mockAuthClient = mockAuthenticationClient
      mockAuthClient.passwordGrant.mockResolvedValue(mockTokenResponse)
      mockAuthClient.getProfile.mockResolvedValue(mockUserProfile)

      await auth0UserService.signIn('test@example.com', 'password123')

      // Verify security event was logged
      const securityModule = await import('../../../src/lib/security/index')
      expect(securityModule.logSecurityEvent).toHaveBeenCalledWith(
        securityModule.SecurityEventType.LOGIN,
        {
          userId: 'auth0|123456',
          email: 'test@example.com',
          method: 'password'
        }
      )
    })

    it('should log security events for role assignments', async () => {


      // Mock role lookup
      mockManagementClient.getRoles.mockResolvedValue([{
        id: 'role-id-123',
        name: 'therapist'
      }])

      // Mock role assignment
      mockManagementClient.assignRolestoUser.mockResolvedValue({})

      await auth0RbacService.assignRoleToUser('auth0|user123', 'therapist')

      // Verify security event was logged
      const securityModule = await import('../../../src/lib/security/index')
      expect(securityModule.logSecurityEvent).toHaveBeenCalledWith(
        securityModule.SecurityEventType.ROLE_ASSIGNED,
        {
          userId: 'auth0|user123',
          role: 'therapist',
          assignedBy: 'system'
        }
      )
    })

    it('should log security events for token validation', async () => {

      const mockPayload = {
        sub: 'auth0|123456',
        iss: 'https://test-domain.auth0.com/',
        aud: 'https://api.pixelatedempathy.com',
        exp: 9999999999,
        jti: 'token-id-123', // Added jti for tokenId expectation
        'https://pixelated.empathy/app_metadata': { roles: ['admin'] }
      }

      const mockAuthClient = mockAuthenticationClient
      mockAuthClient.getProfile.mockResolvedValue(mockPayload)

      await auth0JwtService.validateToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3Rlc3QtZG9tYWluLmF1dGgwLmNvbS8iLCJzdWIiOiJhdXRoMHwxMjM0NTYiLCJhdWQiOiJodHRwczovL2FwaS5waXhlbGF0ZWQtZW1wYXRoeS5jb20iLCJleHAiOjE5OTk5OTk5OTksImlhdCI6MTUxNjIzOTAyMiwiaHR0cHM6Ly9waXhlbGF0ZWQuZW1wYXRoeS9hcHBfbWV0YWRhdGEiOnsicm9sZXMiOlsiYWRtaW4iXX0sImh0dHBzOi8vcGl4ZWxhdGVkLmVtcGF0aHkvdXNlcl9tZXRhZGF0YSI6eyJyb2xlIjoiYWRtaW4ifX0.signature', 'access')

      // Verify security event was logged
      const securityModule = await import('../../../src/lib/security/index')
      expect(securityModule.logSecurityEvent).toHaveBeenCalledWith(
        securityModule.SecurityEventType.TOKEN_VALIDATED,
        {
          userId: 'auth0|123456',
          tokenId: expect.any(String),
          tokenType: 'access',
          sessionId: undefined
        }
      )
    })

    it('should log security events for token refresh', async () => {
      const mockTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600
      }
      const mockUserResponse = {
        sub: 'auth0|123456',
        email: 'test@example.com',
        name: 'Test User',
        jti: 'new-token-id',
        'https://pixelated.empathy/app_metadata': { roles: ['user'] }
      }

      const mockAuthClient = mockAuthenticationClient
      mockAuthClient.refreshToken.mockResolvedValue(mockTokenResponse)
      mockAuthClient.getProfile.mockResolvedValue(mockUserResponse)

      await auth0JwtService.refreshAccessToken('valid-refresh-token', {})

      // Verify security event was logged
      const securityModule = await import('../../../src/lib/security/index')
      expect(securityModule.logSecurityEvent).toHaveBeenCalledWith(
        securityModule.SecurityEventType.TOKEN_REFRESHED,
        {
          userId: 'auth0|123456',
          oldTokenId: 'unknown',
          newAccessTokenId: 'new-token-id',
          newRefreshTokenId: 'present'
        }
      )
    })
  })

  describe('Cross-Flow Integration', () => {
    it('should maintain consistent user data across authentication flows', async () => {
      // Mock user authentication
      const mockTokenResponse = {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3Rlc3QtZG9tYWluLmF1dGgwLmNvbS8iLCJzdWIiOiJhdXRoMHwxMjM0NTYiLCJleHAiOjE5OTk5OTk5OTksImF1ZCI6Imh0dHBzOi8vYXBpLnBpeGVsYXRlZC1lbXBhdGh5LmNvbSJ9.signature',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600
      }
      // Valid dummy JWT for validation
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhdXRoMHx1c2VyMTIzIiwiaXNzIjoiaHR0cHM6Ly90ZXN0LWRvbWFpbi5hdXRoMC5jb20vIiwiYXVkIjoiaHR0cHM6Ly9hcGkucGl4ZWxhdGVkLWVtcGF0aHkuY29tIiwiZXhwIjo5OTk5OTk5OTk5fQ.signature'

      const mockUserProfile = {
        user_id: 'auth0|user123',
        email: 'test@example.com',
        email_verified: true,
        name: 'Test User',
        app_metadata: { roles: ['user'] }, // Use 'user' for consistency
        user_metadata: { role: 'user' },
        'https://pixelated.empathy/app_metadata': { roles: ['user'] },
        'https://pixelated.empathy/user_metadata': { role: 'user' }
      }

      const mockAuthClient = mockAuthenticationClient
      mockAuthClient.passwordGrant.mockResolvedValue(mockTokenResponse)
      mockAuthClient.getProfile.mockResolvedValue(mockUserProfile)

      // 1. Sign In
      const emailAuthResult = await auth0UserService.signIn('test@example.com', 'password123')

      // 2. Validate Token using the result from Sign In (mocked to point to validToken structure)
      // We spy on validateToken to ensure it uses the mock profile internally or we can just call it
      // But validateToken takes a string. We pass our validToken.

      const tokenValidationResult = await auth0JwtService.validateToken(validToken, 'access')

      // Verify consistency
      expect(tokenValidationResult.valid).toBe(true)
      expect(tokenValidationResult.userId).toBe(emailAuthResult.user.id)
      expect(tokenValidationResult.role).toBe(emailAuthResult.user.role)
    })

    it('should properly link social account to existing user', async () => {

      mockManagementClient.linkUsers.mockResolvedValue({})

      await auth0SocialAuthService.linkSocialAccount('auth0|user123', 'google-oauth2', 'access-token-123')

      expect(mockManagementClient.linkUsers).toHaveBeenCalledWith(
        { id: 'auth0|user123' },
        {
          provider: 'google-oauth2',
          connection_id: 'google-oauth2',
          user_id: 'access-token-123'
        }
      )

      // Verify security event was logged
      const securityModule = await import('../../../src/lib/security/index')
      expect(securityModule.logSecurityEvent).toHaveBeenCalledWith(
        securityModule.SecurityEventType.ACCOUNT_LINKED,
        {
          userId: 'auth0|user123',
          provider: 'google-oauth2',
          linkedAt: expect.any(String)
        }
      )
    })

    it('should properly handle role-based access after authentication', async () => {
      // Mock user authentication
      const mockTokenResponse = {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3Rlc3QtZG9tYWluLmF1dGgwLmNvbS8iLCJzdWIiOiJhdXRoMHwxMjM0NTYiLCJleHAiOjE5OTk5OTk5OTksImF1ZCI6Imh0dHBzOi8vYXBpLnBpeGVsYXRlZC1lbXBhdGh5LmNvbSJ9.signature',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600
      }

      const mockUserProfile = {
        user_id: 'auth0|123456',
        email: 'therapist@example.com',
        email_verified: true,
        name: 'Therapist User',
        app_metadata: { roles: ['Therapist'] },
        user_metadata: { role: 'therapist' }
      }

      const mockAuthClient = mockAuthenticationClient
      mockAuthClient.passwordGrant.mockResolvedValue(mockTokenResponse)
      mockAuthClient.getProfile.mockResolvedValue(mockUserProfile)

      // Authenticate user
      const authResult = await auth0UserService.signIn('therapist@example.com', 'password123')

      // Check RBAC permissions
      mockManagementClient.getUserRoles.mockResolvedValue([{ id: 'role-2', name: 'therapist' }])
      // Assuming therapist has permission
      mockManagementClient.getPermissions.mockResolvedValue([{ permission_name: 'read:patients' }])
      const hasPermission = await auth0RbacService.userHasPermission(authResult.user.id, 'read:patients')

      // Therapists should have read:patients permission
      expect(hasPermission).toBe(true)
    })
  })
})