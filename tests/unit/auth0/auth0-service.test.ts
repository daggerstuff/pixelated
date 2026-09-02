import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { Auth0UserService } from '../../../apps/web/src/lib/services/auth0.service'

type MockAuthMethod = ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>

type MockManagementMethods = {
  create: MockAuthMethod
  get: MockAuthMethod
  list: MockAuthMethod
  listUsersByEmail: MockAuthMethod
  update: MockAuthMethod
}

type MockManagementTickets = {
  changePassword: MockAuthMethod
}

type MockManagementClient = {
  users: MockManagementMethods
  tickets: MockManagementTickets
  createUser: MockAuthMethod
  getUser: MockAuthMethod
  getUsers: MockAuthMethod
  listUsersByEmail: MockAuthMethod
  updateUser: MockAuthMethod
  createPasswordChangeTicket: MockAuthMethod
}

type MockAuthOAuthMethods = {
  passwordGrant: MockAuthMethod
  getProfile: MockAuthMethod
  refreshTokenGrant: MockAuthMethod
  revokeRefreshToken: MockAuthMethod
}

type MockAuthMethods = {
  passwordGrant: MockAuthMethod
  getProfile: MockAuthMethod
  refreshToken: MockAuthMethod
  refreshTokenGrant: MockAuthMethod
  revokeRefreshToken: MockAuthMethod
  oauth: MockAuthOAuthMethods
}

type MockUserInfoClient = {
  getUserInfo: MockAuthMethod
}

const mockManagementUserMethods: MockManagementMethods = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  listUsersByEmail: vi.fn(),
  update: vi.fn(),
}))

const mockManagementTickets: MockManagementTickets = vi.hoisted(() => ({
  changePassword: vi.fn(),
}))

const mockManagementClient: MockManagementClient = vi.hoisted(() => {
  return {
    users: mockManagementUserMethods,
    tickets: mockManagementTickets,
    createUser: mockManagementUserMethods.create,
    getUser: mockManagementUserMethods.get,
    getUsers: mockManagementUserMethods.list,
    listUsersByEmail: mockManagementUserMethods.listUsersByEmail,
    updateUser: mockManagementUserMethods.update,
    createPasswordChangeTicket: mockManagementTickets.changePassword,
  }
})

const mockAuthMethods: MockAuthMethods = vi.hoisted(() => {
  const passwordGrant = vi.fn()
  const refreshToken = vi.fn()
  const getProfile = vi.fn()
  const refreshTokenGrant = vi.fn()
  const revokeRefreshToken = vi.fn()
  return {
    passwordGrant,
    getProfile,
    refreshToken,
    refreshTokenGrant: refreshToken,
    revokeRefreshToken,
    oauth: {
      passwordGrant,
      getProfile,
      refreshTokenGrant: refreshToken,
      revokeRefreshToken,
    },
  }
})

const mockUserInfoClient: MockUserInfoClient = vi.hoisted(() => ({
  getUserInfo: vi.fn(),
}))

// Mock the auth0 module
vi.mock('auth0', () => {
  return {
    ManagementClient: vi.fn(function () {
      return mockManagementClient
    }),
    AuthenticationClient: vi.fn(function () {
      return mockAuthMethods
    }),
    UserInfoClient: vi.fn(function () {
      return mockUserInfoClient
    }),
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
          updateOne: vi.fn(),
        }),
      }),
    },
  }
})

describe('Auth0UserService', () => {
  let auth0UserService: Auth0UserService
  let mockAuthenticationClient: MockAuthMethods
  let mockUserInfoClientInstance: MockUserInfoClient

  beforeEach(() => {
    // Reset environment variables
    process.env.AUTH0_DOMAIN = 'test-domain.auth0.com'
    process.env.AUTH0_CLIENT_ID = 'test-client-id'
    process.env.AUTH0_CLIENT_SECRET = 'test-client-secret'
    process.env.AUTH0_AUDIENCE = 'test-audience'
    process.env.AUTH0_MANAGEMENT_CLIENT_ID = 'test-management-client-id'
    process.env.AUTH0_MANAGEMENT_CLIENT_SECRET = 'test-management-client-secret'

    vi.clearAllMocks()

    // Create new instance
    auth0UserService = new Auth0UserService()

    mockAuthenticationClient = mockAuthMethods
    mockUserInfoClientInstance = mockUserInfoClient
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
        expires_in: 3600,
      }

      const mockUserProfile = {
        sub: 'auth0|123456',
        email: 'test@example.com',
        email_verified: true,
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        created_at: '2023-01-01T00:00:00Z',
        last_login: '2023-01-02T00:00:00Z',
        app_metadata: { roles: ['User'] },
        user_metadata: { role: 'user' },
      }

      mockAuthenticationClient.passwordGrant.mockResolvedValue({
        data: mockTokenResponse,
      })
      mockUserInfoClientInstance.getUserInfo.mockResolvedValue({
        data: mockUserProfile,
      })

      const result = await auth0UserService.signIn(
        'test@example.com',
        'password123',
      )

      expect(result).toMatchObject({
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
          userMetadata: { role: 'user' },
        },
        token: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      })

      expect(mockAuthenticationClient.passwordGrant).toHaveBeenCalledWith({
        username: 'test@example.com',
        password: 'password123',
        realm: 'Username-Password-Authentication',
        scope: 'openid profile email',
        audience: 'test-audience',
      })
    })

    it('should throw error for invalid credentials', async () => {
      mockAuthenticationClient.passwordGrant.mockRejectedValue(
        new Error('Unauthorized'),
      )

      await expect(
        auth0UserService.signIn('test@example.com', 'wrongpassword'),
      ).rejects.toThrow('Invalid credentials')
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
        user_metadata: { role: 'user', created_at: '2023-01-01T00:00:00Z' },
      }

      mockManagementClient.createUser.mockResolvedValue({ data: mockAuth0User })

      const result = await auth0UserService.createUser(
        'newuser@example.com',
        'password123',
        'user',
      )

      expect(result).toEqual({
        id: 'auth0|123456',
        email: 'newuser@example.com',
        emailVerified: false,
        role: 'user',
        fullName: undefined,
        avatarUrl: undefined,
        createdAt: '2023-01-01T00:00:00Z',
        appMetadata: { roles: ['User'] },
        userMetadata: { role: 'user', created_at: '2023-01-01T00:00:00Z' },
      })

      expect(mockManagementClient.createUser).toHaveBeenCalled()
      expect(mockManagementClient.createUser.mock.calls[0]?.[0]).toMatchObject({
        email: 'newuser@example.com',
        password: 'password123',
        connection: 'Username-Password-Authentication',
        email_verified: false,
        app_metadata: {
          roles: ['User'],
          imported_from: 'manual_creation',
        },
        user_metadata: {
          role: 'user',
        },
      })
    })

    it('should throw error when user creation fails', async () => {
      mockManagementClient.createUser.mockRejectedValue(
        new Error('User already exists'),
      )

      await expect(
        auth0UserService.createUser(
          'existing@example.com',
          'password123',
          'user',
        ),
      ).rejects.toThrow('Failed to create user')
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
        user_metadata: { role: 'admin' },
      }

      mockManagementClient.getUser.mockResolvedValue({ data: mockAuth0User })

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
        userMetadata: { role: 'admin' },
      })
    })

    it('should return null when user is not found', async () => {
      mockManagementClient.getUser.mockRejectedValue(
        new Error('User not found'),
      )

      const result = await auth0UserService.getUserById('nonexistent-user')

      expect(result).toBeNull()
    })
  })

  describe('findUserByEmail', () => {
    it('should successfully find user by email', async () => {
      const mockAuth0Users = [
        {
          user_id: 'auth0|123456',
          email: 'test@example.com',
          email_verified: true,
          name: 'Test User',
          picture: 'https://example.com/avatar.jpg',
          created_at: '2023-01-01T00:00:00Z',
          last_login: '2023-01-02T00:00:00Z',
          app_metadata: { roles: ['Therapist'] },
          user_metadata: { role: 'therapist' },
        },
      ]

      mockManagementClient.listUsersByEmail.mockResolvedValue(mockAuth0Users)

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
        userMetadata: { role: 'therapist' },
      })

      expect(mockManagementClient.listUsersByEmail).toHaveBeenCalledWith({
        email: 'test@example.com',
      })
    })

    it('should return null when user is not found', async () => {
      mockManagementClient.listUsersByEmail.mockResolvedValue([])

      const result = await auth0UserService.findUserByEmail(
        'nonexistent@example.com',
      )

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
        user_metadata: { role: 'user', updated_field: 'new_value' },
      }

      mockManagementClient.updateUser.mockResolvedValue({ data: mockAuth0User })

      const updates = {
        email: 'updated@example.com',
        fullName: 'Updated User',
        role: 'user',
        customField: 'new_value',
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
        userMetadata: { role: 'user', updated_field: 'new_value' },
      })

      expect(mockManagementClient.updateUser).toHaveBeenCalledWith(
        'auth0|123456',
        {
          email: 'updated@example.com',
          user_metadata: {
            fullName: 'Updated User',
            customField: 'new_value',
            role: 'user',
          },
          app_metadata: {
            roles: ['User'],
          },
        },
      )
    })

    it('should return null when update fails', async () => {
      mockManagementClient.updateUser.mockRejectedValue(
        new Error('Update failed'),
      )

      const result = await auth0UserService.updateUser('auth0|123456', {
        fullName: 'Updated Name',
      })

      expect(result).toBeNull()
    })
  })

  describe('changePassword', () => {
    it('should successfully change user password', async () => {
      mockManagementClient.updateUser.mockResolvedValue({ data: {} })

      await expect(
        auth0UserService.changePassword('auth0|123456', 'newpassword123'),
      ).resolves.not.toThrow()

      expect(mockManagementClient.updateUser).toHaveBeenCalledWith(
        'auth0|123456',
        { password: 'newpassword123' },
      )
    })

    it('should throw error when password change fails', async () => {
      mockManagementClient.updateUser.mockRejectedValue(
        new Error('Password policy violation'),
      )

      await expect(
        auth0UserService.changePassword('auth0|123456', 'weak'),
      ).rejects.toThrow('Failed to change password')
    })
  })

  describe('signOut', () => {
    it('should successfully revoke refresh token', async () => {
      mockAuthenticationClient.revokeRefreshToken.mockResolvedValue({})

      await auth0UserService.signOut('mock-refresh-token')

      expect(mockAuthenticationClient.revokeRefreshToken).toHaveBeenCalledWith({
        token: 'mock-refresh-token',
      })
    })

    it('should not throw error when sign out fails', async () => {
      mockAuthenticationClient.revokeRefreshToken.mockRejectedValue(
        new Error('Invalid token'),
      )

      await expect(
        auth0UserService.signOut('invalid-token'),
      ).resolves.not.toThrow()
    })
  })

  describe('refreshSession', () => {
    it('should successfully refresh user session', async () => {
      const mockTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
      }

      const mockUserProfile = {
        sub: 'auth0|123456',
        email: 'test@example.com',
        email_verified: true,
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        created_at: '2023-01-01T00:00:00Z',
        last_login: '2023-01-02T00:00:00Z',
        app_metadata: { roles: ['User'] },
        user_metadata: { role: 'user' },
      }

      mockAuthenticationClient.refreshToken.mockResolvedValue({
        data: mockTokenResponse,
      })
      mockUserInfoClientInstance.getUserInfo.mockResolvedValue({
        data: mockUserProfile,
      })

      const result = await auth0UserService.refreshSession('old-refresh-token')

      expect(result).toMatchObject({
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
          userMetadata: { role: 'user' },
        },
        accessToken: 'new-access-token',
        session: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        },
      })
      expect(result.session.expiresAt).toBeInstanceOf(Date)

      expect(mockAuthenticationClient.refreshToken).toHaveBeenCalledWith({
        refresh_token: 'old-refresh-token',
      })
    })

    it('should throw error when session refresh fails', async () => {
      mockAuthenticationClient.refreshToken.mockRejectedValue(
        new Error('Invalid refresh token'),
      )

      await expect(
        auth0UserService.refreshSession('invalid-refresh-token'),
      ).rejects.toThrow('Failed to refresh session')
    })
  })

  describe('verifyAuthToken', () => {
    it('should successfully verify authentication token', async () => {
      const mockDecodedToken = {
        sub: 'auth0|123456',
        user_id: 'auth0|123456',
        email: 'test@example.com',
        app_metadata: { roles: ['Admin'] },
      }

      mockUserInfoClientInstance.getUserInfo.mockResolvedValue({
        data: mockDecodedToken,
      })

      const result = await auth0UserService.verifyAuthToken('valid-jwt-token')

      expect(result).toEqual({
        userId: 'auth0|123456',
        email: 'test@example.com',
        role: 'admin',
      })
    })

    it('should throw error for invalid token', async () => {
      mockUserInfoClientInstance.getUserInfo.mockRejectedValue(
        new Error('Invalid token'),
      )

      await expect(
        auth0UserService.verifyAuthToken('invalid-jwt-token'),
      ).rejects.toThrow('Invalid token')
    })
  })

  describe('createPasswordResetTicket', () => {
    it('should successfully create password reset ticket', async () => {
      const mockTicket = {
        ticket: 'https://test-domain.auth0.com/lo/reset?ticket=abc123',
      }

      mockManagementClient.createPasswordChangeTicket.mockResolvedValue({
        data: mockTicket,
      })

      const result = await auth0UserService.createPasswordResetTicket(
        'auth0|123456',
        'https://example.com/reset-complete',
      )

      expect(result).toBe(
        'https://test-domain.auth0.com/lo/reset?ticket=abc123',
      )

      expect(
        mockManagementClient.createPasswordChangeTicket,
      ).toHaveBeenCalledWith({
        user_id: 'auth0|123456',
        result_url: 'https://example.com/reset-complete',
        ttl_sec: 3600,
      })
    })

    it('should throw error when ticket creation fails', async () => {
      mockManagementClient.createPasswordChangeTicket.mockRejectedValue(
        new Error('User not found'),
      )

      await expect(
        auth0UserService.createPasswordResetTicket('nonexistent-user'),
      ).rejects.toThrow('Failed to create password reset ticket')
    })
  })

  describe('role mapping', () => {
    it('should correctly map internal roles to Auth0 roles', async () => {
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
        user_metadata: { role: 'admin', created_at: '2023-01-01T00:00:00Z' },
      }

      mockManagementClient.createUser.mockResolvedValue({ data: mockAuth0User })

      // Test admin role mapping
      const result = await auth0UserService.createUser(
        'admin@example.com',
        'password123',
        'admin',
      )

      expect(result).toBeDefined()
      expect(result.appMetadata).toBeDefined()
      expect(result.role).toBe('admin')
      expect(result.appMetadata?.roles).toEqual(['Admin'])
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
        user_metadata: { role: 'therapist' },
      }

      mockManagementClient.getUser.mockResolvedValue({ data: mockAuth0User })

      const result = await auth0UserService.getUserById('auth0|123456')

      expect(result).toBeDefined()
      if (!result) {
        throw new Error('User should be returned for role mapping test')
      }
      expect(result.appMetadata).toBeDefined()
      if (!result.appMetadata) {
        throw new Error('appMetadata should be defined for role mapping test')
      }
      expect(result.role).toBe('therapist')
    })
  })
})
