import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Auth0UserService } from '../../../src/services/auth0.service'

// Mock the auth0 module
vi.mock('auth0', () => {
  return {
    ManagementClient: vi.fn().mockImplementation(() => {
      return {
        createUser: vi.fn(),
        getUser: vi.fn(),
        getUsers: vi.fn(),
        updateUser: vi.fn(),
        createPasswordChangeTicket: vi.fn()
      }
    }),
    AuthenticationClient: vi.fn().mockImplementation(() => {
      return {
        passwordGrant: vi.fn(),
        getProfile: vi.fn(),
        refreshToken: vi.fn(),
        revokeRefreshToken: vi.fn()
      }
    })
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

describe('Auth0UserService', () => {
  let auth0UserService: Auth0UserService
  let mockManagementClient: any
  let mockAuthenticationClient: any

  beforeEach(() => {
    // Reset environment variables
    process.env.AUTH0_DOMAIN = 'test-domain.auth0.com'
    process.env.AUTH0_CLIENT_ID = 'test-client-id'
    process.env.AUTH0_CLIENT_SECRET = 'test-client-secret'
    process.env.AUTH0_AUDIENCE = 'test-audience'
    process.env.AUTH0_MANAGEMENT_CLIENT_ID = 'test-management-client-id'
    process.env.AUTH0_MANAGEMENT_CLIENT_SECRET = 'test-management-client-secret'

    // Create new instance
    auth0UserService = new Auth0UserService()

    // Get the mock clients
    const auth0Module = require('auth0')
    mockManagementClient = auth0Module.ManagementClient.mock.results[0].value
    mockAuthenticationClient = auth0Module.AuthenticationClient.mock.results[0].value
  })

  afterEach(() => {
    vi.clearAllMocks()
    delete process.env.AUTH0_DOMAIN
    delete process.env.AUTH0_CLIENT_ID
    delete process.env.AUTH0_CLIENT_SECRET
    delete process.env.AUTH0_AUDIENCE
    delete process.env.AUTH0_MANAGEMENT_CLIENT_ID
    delete process.env.AUTH0_MANAGEMENT_CLIENT_SECRET
  })

  describe('signIn', () => {
    it('should successfully sign in a user with valid credentials', async () => {
      const mockTokenResponse = {
        access_token: 'mock-access-token',
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
        app_metadata: { roles: ['User'] },
        user_metadata: { role: 'user' }
      }

      mockAuthenticationClient.passwordGrant.mockResolvedValue(mockTokenResponse)
      mockAuthenticationClient.getProfile.mockResolvedValue(mockUserProfile)

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
          appMetadata: { roles: ['User'] },
          userMetadata: { role: 'user' }
        },
        token: 'mock-access-token',
        refreshToken: 'mock-refresh-token'
      })

      expect(mockAuthenticationClient.passwordGrant).toHaveBeenCalledWith({
        username: 'test@example.com',
        password: 'password123',
        realm: 'Username-Password-Authentication',
        scope: 'openid profile email',
        audience: 'test-audience'
      })
    })

    it('should throw error for invalid credentials', async () => {
      mockAuthenticationClient.passwordGrant.mockRejectedValue(new Error('Unauthorized'))

      await expect(auth0UserService.signIn('test@example.com', 'wrongpassword'))
        .rejects.toThrow('Invalid credentials')
    })
  })

  describe('createUser', () => {
    it('should successfully create a new user', async () => {
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

    it('should throw error when user creation fails', async () => {
      mockManagementClient.createUser.mockRejectedValue(new Error('User already exists'))

      await expect(auth0UserService.createUser('existing@example.com', 'password123', 'user'))
        .rejects.toThrow('Failed to create user')
    })
  })

  describe('getUserById', () => {
    it('should successfully retrieve user by ID', async () => {
      const mockAuth0User = {
        user_id: 'auth0|123456',
        email: 'test@example.com',
        email_verified: true,
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        created_at: '2023-01-01T00:00:00Z',
        last_login: '2023-01-02T00:00:00Z',
        app_metadata: { roles: ['Admin'] },
        user_metadata: { role: 'admin' }
      }

      mockManagementClient.getUser.mockResolvedValue(mockAuth0User)

      const result = await auth0UserService.getUserById('auth0|123456')

      expect(result).toEqual({
        id: 'auth0|123456',
        email: 'test@example.com',
        emailVerified: true,
        role: 'admin',
        fullName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        createdAt: '2023-01-01T00:00:00Z',
        lastLogin: '2023-01-02T00:00:00Z',
        appMetadata: { roles: ['Admin'] },
        userMetadata: { role: 'admin' }
      })
    })

    it('should return null when user is not found', async () => {
      mockManagementClient.getUser.mockRejectedValue(new Error('User not found'))

      const result = await auth0UserService.getUserById('nonexistent-user')

      expect(result).toBeNull()
    })
  })

  describe('findUserByEmail', () => {
    it('should successfully find user by email', async () => {
      const mockAuth0Users = [{
        user_id: 'auth0|123456',
        email: 'test@example.com',
        email_verified: true,
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        created_at: '2023-01-01T00:00:00Z',
        last_login: '2023-01-02T00:00:00Z',
        app_metadata: { roles: ['Therapist'] },
        user_metadata: { role: 'therapist' }
      }]

      mockManagementClient.getUsers.mockResolvedValue(mockAuth0Users)

      const result = await auth0UserService.findUserByEmail('test@example.com')

      expect(result).toEqual({
        id: 'auth0|123456',
        email: 'test@example.com',
        emailVerified: true,
        role: 'therapist',
        fullName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        createdAt: '2023-01-01T00:00:00Z',
        lastLogin: '2023-01-02T00:00:00Z',
        appMetadata: { roles: ['Therapist'] },
        userMetadata: { role: 'therapist' }
      })

      expect(mockManagementClient.getUsers).toHaveBeenCalledWith({
        q: 'email:"test@example.com"',
        search_engine: 'v3'
      })
    })

    it('should return null when user is not found', async () => {
      mockManagementClient.getUsers.mockResolvedValue([])

      const result = await auth0UserService.findUserByEmail('nonexistent@example.com')

      expect(result).toBeNull()
    })
  })

  describe('updateUser', () => {
    it('should successfully update user profile', async () => {
      const mockAuth0User = {
        user_id: 'auth0|123456',
        email: 'updated@example.com',
        email_verified: true,
        name: 'Updated User',
        picture: 'https://example.com/new-avatar.jpg',
        created_at: '2023-01-01T00:00:00Z',
        last_login: '2023-01-02T00:00:00Z',
        app_metadata: { roles: ['User'] },
        user_metadata: { role: 'user', updated_field: 'new_value' }
      }

      mockManagementClient.updateUser.mockResolvedValue(mockAuth0User)

      const updates = {
        email: 'updated@example.com',
        fullName: 'Updated User',
        role: 'user',
        customField: 'new_value'
      }

      const result = await auth0UserService.updateUser('auth0|123456', updates)

      expect(result).toEqual({
        id: 'auth0|123456',
        email: 'updated@example.com',
        emailVerified: true,
        role: 'user',
        fullName: 'Updated User',
        avatarUrl: 'https://example.com/new-avatar.jpg',
        createdAt: '2023-01-01T00:00:00Z',
        lastLogin: '2023-01-02T00:00:00Z',
        appMetadata: { roles: ['User'] },
        userMetadata: { role: 'user', updated_field: 'new_value' }
      })

      expect(mockManagementClient.updateUser).toHaveBeenCalledWith(
        { id: 'auth0|123456' },
        {
          email: 'updated@example.com',
          user_metadata: {
            fullName: 'Updated User',
            customField: 'new_value'
          },
          app_metadata: {
            roles: ['User']
          }
        }
      )
    })

    it('should return null when update fails', async () => {
      mockManagementClient.updateUser.mockRejectedValue(new Error('Update failed'))

      const result = await auth0UserService.updateUser('auth0|123456', { fullName: 'Updated Name' })

      expect(result).toBeNull()
    })
  })

  describe('changePassword', () => {
    it('should successfully change user password', async () => {
      mockManagementClient.updateUser.mockResolvedValue({})

      await expect(auth0UserService.changePassword('auth0|123456', 'newpassword123'))
        .resolves.not.toThrow()

      expect(mockManagementClient.updateUser).toHaveBeenCalledWith(
        { id: 'auth0|123456' },
        { password: 'newpassword123' }
      )
    })

    it('should throw error when password change fails', async () => {
      mockManagementClient.updateUser.mockRejectedValue(new Error('Password policy violation'))

      await expect(auth0UserService.changePassword('auth0|123456', 'weak'))
        .rejects.toThrow('Failed to change password')
    })
  })

  describe('signOut', () => {
    it('should successfully revoke refresh token', async () => {
      mockAuthenticationClient.revokeRefreshToken.mockResolvedValue({})

      await auth0UserService.signOut('mock-refresh-token')

      expect(mockAuthenticationClient.revokeRefreshToken).toHaveBeenCalledWith({
        token: 'mock-refresh-token'
      })
    })

    it('should not throw error when sign out fails', async () => {
      mockAuthenticationClient.revokeRefreshToken.mockRejectedValue(new Error('Invalid token'))

      await expect(auth0UserService.signOut('invalid-token'))
        .resolves.not.toThrow()
    })
  })

  describe('refreshSession', () => {
    it('should successfully refresh user session', async () => {
      const mockTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
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
        app_metadata: { roles: ['User'] },
        user_metadata: { role: 'user' }
      }

      mockAuthenticationClient.refreshToken.mockResolvedValue(mockTokenResponse)
      mockAuthenticationClient.getProfile.mockResolvedValue(mockUserProfile)

      const result = await auth0UserService.refreshSession('old-refresh-token')

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
          appMetadata: { roles: ['User'] },
          userMetadata: { role: 'user' }
        },
        session: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresAt: expect.any(Date)
        },
        accessToken: 'new-access-token'
      })

      expect(mockAuthenticationClient.refreshToken).toHaveBeenCalledWith({
        refresh_token: 'old-refresh-token'
      })
    })

    it('should throw error when session refresh fails', async () => {
      mockAuthenticationClient.refreshToken.mockRejectedValue(new Error('Invalid refresh token'))

      await expect(auth0UserService.refreshSession('invalid-refresh-token'))
        .rejects.toThrow('Failed to refresh session')
    })
  })

  describe('verifyAuthToken', () => {
    it('should successfully verify authentication token', async () => {
      const mockDecodedToken = {
        user_id: 'auth0|123456',
        email: 'test@example.com',
        app_metadata: { roles: ['Admin'] }
      }

      mockAuthenticationClient.getProfile.mockResolvedValue(mockDecodedToken)

      const result = await auth0UserService.verifyAuthToken('valid-jwt-token')

      expect(result).toEqual({
        userId: 'auth0|123456',
        email: 'test@example.com',
        role: 'admin'
      })
    })

    it('should throw error for invalid token', async () => {
      mockAuthenticationClient.getProfile.mockRejectedValue(new Error('Invalid token'))

      await expect(auth0UserService.verifyAuthToken('invalid-jwt-token'))
        .rejects.toThrow('Invalid token')
    })
  })

  describe('createPasswordResetTicket', () => {
    it('should successfully create password reset ticket', async () => {
      const mockTicket = {
        ticket: 'https://test-domain.auth0.com/lo/reset?ticket=abc123'
      }

      mockManagementClient.createPasswordChangeTicket.mockResolvedValue(mockTicket)

      const result = await auth0UserService.createPasswordResetTicket('auth0|123456', 'https://example.com/reset-complete')

      expect(result).toBe('https://test-domain.auth0.com/lo/reset?ticket=abc123')

      expect(mockManagementClient.createPasswordChangeTicket).toHaveBeenCalledWith({
        user_id: 'auth0|123456',
        result_url: 'https://example.com/reset-complete',
        ttl_sec: 3600
      })
    })

    it('should throw error when ticket creation fails', async () => {
      mockManagementClient.createPasswordChangeTicket.mockRejectedValue(new Error('User not found'))

      await expect(auth0UserService.createPasswordResetTicket('nonexistent-user'))
        .rejects.toThrow('Failed to create password reset ticket')
    })
  })

  describe('role mapping', () => {
    it('should correctly map internal roles to Auth0 roles', () => {
      // This test would require accessing private methods, so we'll test indirectly
      // through the createUser method which uses role mapping
      const mockAuth0User = {
        user_id: 'auth0|123456',
        email: 'admin@example.com',
        email_verified: false,
        name: null,
        picture: null,
        created_at: '2023-01-01T00:00:00Z',
        app_metadata: { roles: ['Admin'] },
        user_metadata: { role: 'admin', created_at: '2023-01-01T00:00:00Z' }
      }

      mockManagementClient.createUser.mockResolvedValue(mockAuth0User)

      // Test admin role mapping
      auth0UserService.createUser('admin@example.com', 'password123', 'admin')

      expect(mockManagementClient.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          app_metadata: expect.objectContaining({
            roles: ['Admin']
          }),
          user_metadata: expect.objectContaining({
            role: 'admin'
          })
        })
      )
    })

    it('should correctly map Auth0 roles to internal roles', async () => {
      const mockAuth0User = {
        user_id: 'auth0|123456',
        email: 'therapist@example.com',
        email_verified: true,
        name: 'Therapist User',
        picture: null,
        created_at: '2023-01-01T00:00:00Z',
        last_login: '2023-01-02T00:00:00Z',
        app_metadata: { roles: ['Therapist'] },
        user_metadata: { role: 'therapist' }
      }

      mockManagementClient.getUser.mockResolvedValue(mockAuth0User)

      const result = await auth0UserService.getUserById('auth0|123456')

      expect(result?.role).toBe('therapist')
    })
  })
})