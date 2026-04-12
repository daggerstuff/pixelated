import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { Auth0UserService } from '../../../src/services/auth0.service'

// Mock the auth0 module
const { mockManagementClient, mockAuthenticationClient, mockUserInfoClient } = vi.hoisted(() => {
  const mockManagementClient = {
    users: {
      create: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(),
      update: vi.fn(),
    },
    tickets: {
      changePassword: vi.fn(),
    }
  };

  const mockAuthenticationClient = {
    oauth: {
      passwordGrant: vi.fn(),
      refreshTokenGrant: vi.fn(),
      revokeRefreshToken: vi.fn(),
    },
    getProfile: vi.fn(),
  };




  const mockUserInfoClient = {
    getUserInfo: vi.fn(),
  };

  return { mockManagementClient, mockAuthenticationClient, mockUserInfoClient };
});

vi.mock('auth0', () => {
  return {
    ManagementClient: class { constructor() { return mockManagementClient; } },
    AuthenticationClient: class { constructor() { return mockAuthenticationClient; } },
    UserInfoClient: class { constructor() { return mockUserInfoClient; } },
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




  beforeEach(() => {
    // Reset environment variables
    process.env.AUTH0_DOMAIN = 'test-domain.auth0.com'
    process.env.AUTH0_CLIENT_ID = 'test-client-id'
    process.env.AUTH0_CLIENT_SECRET = 'test-client-secret'
    process.env.AUTH0_AUDIENCE = 'test-audience'
    process.env.AUTH0_MANAGEMENT_CLIENT_ID = 'test-management-client-id'
    process.env.AUTH0_MANAGEMENT_CLIENT_SECRET = 'test-management-client-secret'

    auth0UserService = new Auth0UserService()
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
        user_id: 'auth0|123456',
        email: 'test@example.com',
        email_verified: true,
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        created_at: '2023-01-01T00:00:00Z',
        last_login: '2023-01-02T00:00:00Z',
        app_metadata: { roles: ['User'] },
        user_metadata: { role: 'user' },
      }

      mockAuthenticationClient.oauth.passwordGrant.mockResolvedValue({ data: mockTokenResponse })
      mockUserInfoClient.getUserInfo.mockResolvedValue({ data: mockUserProfile })

      const result = await auth0UserService.signIn(
        'test@example.com',
        'password123',
      )

      expect(result).toEqual({
        user: {
          id: 'auth0|123456',
          email: 'test@example.com',
          emailVerified: true,
          role: 'user',
          fullName: 'Test User',
          avatarUrl: 'https://example.com/avatar.jpg',
          createdAt: '2023-01-01T00:00:00Z',
          lastLogin: expect.any(String),
          appMetadata: { roles: ['User'] },
          userMetadata: { role: 'user' },
        },
        token: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      })

      expect(mockAuthenticationClient.oauth.passwordGrant).toHaveBeenCalledWith({
        username: 'test@example.com',
        password: 'password123',
        realm: 'Username-Password-Authentication',
        scope: 'openid profile email',
        audience: 'test-audience',
      })
    })

    it('should throw error for invalid credentials', async () => {
      mockAuthenticationClient.oauth.passwordGrant.mockRejectedValue(
        new Error('Unauthorized'),
      )

      await expect(
        auth0UserService.signIn('test@example.com', 'wrongpassword'),
      ).rejects.toThrow('Invalid credentials')
    })

    it('should throw error when missing try/catch for Auth0 password grant is tested', async () => {
      // Specifically override the mock for this test to ensure .oauth is present and rejects
      const mockError = new Error('Auth0 Network Error');
      auth0UserService['auth0Authentication'] = {
        oauth: {
          passwordGrant: vi.fn().mockRejectedValue(mockError)
        }
      } as any;

      await expect(
        auth0UserService.signIn('test@example.com', 'password123')
      ).rejects.toThrow('Invalid credentials');
    })

    it('should throw error when missing try/catch for Auth0 password grant is tested', async () => {
      // Mock the oauth.passwordGrant specifically
      mockAuthenticationClient.oauth.passwordGrant.mockRejectedValue(
        new Error('Network Error')
      );

      await expect(
        auth0UserService.signIn('test@example.com', 'password123')
      ).rejects.toThrow('Invalid credentials');
    })
  })

  describe('createUser', () => {
    it('should successfully create a new user', async () => {
      const mockAuth0User = {
        sub: 'auth0|123456',
        user_id: 'auth0|123456',
        email: 'newuser@example.com',
        email_verified: false,
        name: null,
        picture: null,
        created_at: '2023-01-01T00:00:00Z',
        app_metadata: { roles: ['User'] },
        user_metadata: { role: 'user', created_at: '2023-01-01T00:00:00Z' },
      }

      mockManagementClient.users.create.mockResolvedValue({ data: mockAuth0User })

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
        fullName: null,
        avatarUrl: null,
        createdAt: '2023-01-01T00:00:00Z',
        appMetadata: { roles: ['User'] },
        userMetadata: { role: 'user', created_at: '2023-01-01T00:00:00Z' },
      })

      expect(mockManagementClient.users.create).toHaveBeenCalledWith({
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
          created_at: expect.any(String),
        },
      })
    })

    it('should throw error when user creation fails', async () => {
      mockManagementClient.users.create.mockRejectedValue(
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
        sub: 'auth0|123456',
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

      mockManagementClient.users.get.mockResolvedValue({ data: mockAuth0User })

      const result = await auth0UserService.getUserById('auth0|123456')

      expect(result).toEqual({
        id: 'auth0|123456',
        email: 'test@example.com',
        emailVerified: true,
        role: 'admin',
        fullName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        createdAt: '2023-01-01T00:00:00Z',
        lastLogin: expect.any(String),
        appMetadata: { roles: ['Admin'] },
        userMetadata: { role: 'admin' },
      })
    })

    it('should return null when user is not found', async () => {
      mockManagementClient.users.get.mockRejectedValue(
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
          sub: 'auth0|123456',
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

      mockManagementClient.users.gets.mockResolvedValue(mockAuth0Users)

      const result = await auth0UserService.findUserByEmail('test@example.com')

      expect(result).toEqual({
        id: 'auth0|123456',
        email: 'test@example.com',
        emailVerified: true,
        role: 'therapist',
        fullName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        createdAt: '2023-01-01T00:00:00Z',
        lastLogin: expect.any(String),
        appMetadata: { roles: ['Therapist'] },
        userMetadata: { role: 'therapist' },
      })

      expect(mockManagementClient.users.gets).toHaveBeenCalledWith({
        q: 'email:"test@example.com"',
        search_engine: 'v3',
      })
    })

    it('should return null when user is not found', async () => {
      mockManagementClient.users.gets.mockResolvedValue([])

      const result = await auth0UserService.findUserByEmail(
        'nonexistent@example.com',
      )

      expect(result).toBeNull()
    })
  })

  describe('updateUser', () => {
    it('should successfully update user profile', async () => {
      const mockAuth0User = {
        sub: 'auth0|123456',
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

      mockManagementClient.users.update.mockResolvedValue(mockAuth0User)

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
        lastLogin: expect.any(String),
        appMetadata: { roles: ['User'] },
        userMetadata: { role: 'user', updated_field: 'new_value' },
      })

      expect(mockManagementClient.users.update).toHaveBeenCalledWith(
        { id: 'auth0|123456' },
        {
          email: 'updated@example.com',
          user_metadata: {
            fullName: 'Updated User',
            customField: 'new_value',
          },
          app_metadata: {
            roles: ['User'],
          },
        },
      )
    })

    it('should return null when update fails', async () => {
      mockManagementClient.users.update.mockRejectedValue(
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
      mockManagementClient.users.update.mockResolvedValue({ data: {} })

      await expect(
        auth0UserService.changePassword('auth0|123456', 'newpassword123'),
      ).resolves.not.toThrow()

      expect(mockManagementClient.users.update).toHaveBeenCalledWith({ id: 'auth0|123456' }, { password: 'newpassword123' })
    })

    it('should throw error when password change fails', async () => {
      mockManagementClient.users.update.mockRejectedValue(
        new Error('Password policy violation'),
      )

      await expect(
        auth0UserService.changePassword('auth0|123456', 'weak'),
      ).rejects.toThrow('Failed to change password')
    })
  })

  describe('signOut', () => {
    it('should successfully revoke refresh token', async () => {
      mockAuthenticationClient.oauth.revokeRefreshToken.mockResolvedValue({})

      await auth0UserService.signOut('mock-refresh-token')

      expect(mockAuthenticationClient.oauth.revokeRefreshToken).toHaveBeenCalledWith({
        token: 'mock-refresh-token',
      })
    })

    it('should not throw error when sign out fails', async () => {
      mockAuthenticationClient.oauth.revokeRefreshToken.mockRejectedValue(
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
        user_id: 'auth0|123456',
        email: 'test@example.com',
        email_verified: true,
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        created_at: '2023-01-01T00:00:00Z',
        last_login: '2023-01-02T00:00:00Z',
        app_metadata: { roles: ['User'] },
        user_metadata: { role: 'user' },
      }

      mockAuthenticationClient.oauth.refreshTokenGrant.mockResolvedValue({ data: mockTokenResponse })
      mockUserInfoClient.getUserInfo.mockResolvedValue({ data: mockUserProfile })

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
          lastLogin: expect.any(String),
          appMetadata: { roles: ['User'] },
          userMetadata: { role: 'user' },
        },
        session: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresAt: expect.any(Date),
        },
        accessToken: 'new-access-token',
      })

      expect(mockAuthenticationClient.oauth.refreshTokenGrant).toHaveBeenCalledWith({
        refresh_token: 'old-refresh-token',
      })
    })

    it('should throw error when session refresh fails', async () => {
      mockAuthenticationClient.oauth.refreshTokenGrant.mockRejectedValue(
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

      mockUserInfoClient.getUserInfo.mockResolvedValue({ data: mockDecodedToken })

      const result = await auth0UserService.verifyAuthToken('valid-jwt-token')

      expect(result).toEqual({
        userId: 'auth0|123456',
        email: 'test@example.com',
        role: 'admin',
      })
    })

    it('should throw error for invalid token', async () => {
      mockUserInfoClient.getUserInfo.mockRejectedValue(
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

      mockManagementClient.tickets.changePassword.mockResolvedValue(
        mockTicket,
      )

      const result = await auth0UserService.createPasswordResetTicket(
        'auth0|123456',
        'https://example.com/reset-complete',
      )

      expect(result).toBe(
        'https://test-domain.auth0.com/lo/reset?ticket=abc123',
      )

      expect(
        mockManagementClient.tickets.changePassword,
      ).toHaveBeenCalledWith({
        sub: 'auth0|123456',
        user_id: 'auth0|123456',
        result_url: 'https://example.com/reset-complete',
        ttl_sec: 3600,
      })
    })

    it('should throw error when ticket creation fails', async () => {
      mockManagementClient.tickets.changePassword.mockRejectedValue(
        new Error('User not found'),
      )

      await expect(
        auth0UserService.createPasswordResetTicket('nonexistent-user'),
      ).rejects.toThrow('Failed to create password reset ticket')
    })
  })

  describe('role mapping', () => {
    it('should correctly map internal roles to Auth0 roles', () => {
      // This test would require accessing private methods, so we'll test indirectly
      // through the createUser method which uses role mapping
      const mockAuth0User = {
        sub: 'auth0|123456',
        user_id: 'auth0|123456',
        email: 'admin@example.com',
        email_verified: false,
        name: null,
        picture: null,
        created_at: '2023-01-01T00:00:00Z',
        app_metadata: { roles: ['Admin'] },
        user_metadata: { role: 'admin', created_at: '2023-01-01T00:00:00Z' },
      }

      mockManagementClient.users.create.mockResolvedValue({ data: mockAuth0User })

      // Test admin role mapping
      void auth0UserService.createUser(
        'admin@example.com',
        'password123',
        'admin',
      )

      expect(mockManagementClient.users.create).toHaveBeenCalledWith(
        expect.objectContaining({
          app_metadata: expect.objectContaining({
            roles: ['Admin'],
          }),
          user_metadata: expect.objectContaining({
            role: 'admin',
          }),
        }),
      )
    })

    it('should correctly map Auth0 roles to internal roles', async () => {
      const mockAuth0User = {
        sub: 'auth0|123456',
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

      mockManagementClient.users.get.mockResolvedValue({ data: mockAuth0User })

      const result = await auth0UserService.getUserById('auth0|123456')

      expect(result?.role).toBe('therapist')
    })
  })
})
