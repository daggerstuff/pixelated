/**
 * Auth0 Service for Pixelated Empathy Platform
 *
 * This service provides authentication functionality using Auth0 instead of the
 * previous MongoDB-based authentication system.
 */

import { AuthenticationClient, ManagementClient, UserInfoClient } from 'auth0';
import type { Db } from 'mongodb'
import { mongodb } from '../config/mongodb.config'
import { auth0MFAService } from '../lib/auth/auth0-mfa-service'
import { auth0WebAuthnService } from '../lib/auth/auth0-webauthn-service'
import type { MFAFactor, MFAEnrollment, MFAVerification } from '../lib/auth/auth0-mfa-service'
import type { WebAuthnCredential, WebAuthnRegistrationOptions, WebAuthnAuthenticationOptions } from '../lib/auth/auth0-webauthn-service'
import { logSecurityEvent, SecurityEventType } from '../lib/security/index'

// Auth0 Configuration
const AUTH0_CONFIG = {
  domain: process.env.AUTH0_DOMAIN || '',
  clientId: process.env.AUTH0_CLIENT_ID || '',
  clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
  audience: process.env.AUTH0_AUDIENCE || '',
  managementClientId: process.env.AUTH0_MANAGEMENT_CLIENT_ID || '',
  managementClientSecret: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET || '',
}

// Initialize Auth0 clients
let auth0Management: ManagementClient | null = null
let auth0Authentication: AuthenticationClient | null = null
let auth0UserInfo: UserInfoClient | null = null

/**
 * Initialize Auth0 clients
 */
function initializeAuth0Clients() {
  const domain = process.env.AUTH0_DOMAIN || AUTH0_CONFIG.domain
  const managementClientId = process.env.AUTH0_MANAGEMENT_CLIENT_ID || AUTH0_CONFIG.managementClientId
  const managementClientSecret = process.env.AUTH0_MANAGEMENT_CLIENT_SECRET || AUTH0_CONFIG.managementClientSecret
  const clientId = process.env.AUTH0_CLIENT_ID || AUTH0_CONFIG.clientId
  const clientSecret = process.env.AUTH0_CLIENT_SECRET || AUTH0_CONFIG.clientSecret

  if (!domain || !managementClientId || !managementClientSecret) {
    console.warn('Auth0 configuration is incomplete. Authentication features may not work.', { domain, managementClientId, managementClientSecret })
    return
  }

  if (!auth0Management) {
    auth0Management = new ManagementClient({
      domain: domain,
      clientId: managementClientId,
      clientSecret: managementClientSecret,
      audience: `https://${domain}/api/v2/`,
    })
  }

  if (!auth0Authentication) {
    auth0Authentication = new AuthenticationClient({
      domain: domain,
      clientId: clientId,
      clientSecret: clientSecret
    })
  }

  if (!auth0UserInfo) {
    auth0UserInfo = new UserInfoClient({
      domain: domain,
    });
  }
}

/**
 * Reset Auth0 clients (for testing)
 */
export function resetAuth0ServiceClients() {
  auth0Management = null
  auth0Authentication = null
  auth0UserInfo = null
}

/**
 * Auth0 User Service Class
 */
export class Auth0UserService {
  private db: Db | null = null

  constructor() {
    // Initialize Auth0 clients
    initializeAuth0Clients()
  }

  /**
   * Connect to MongoDB for additional user data
   */
  private async connectToDatabase(): Promise<Db> {
    if (!this.db) {
      this.db = await mongodb.connect()
    }
    return this.db
  }

  /**
   * Sign in a user with email and password
   * @param email User email
   * @param password User password
   * @returns User and access token
   */
  async signIn(email: string, password: string) {
    if (!auth0Authentication || !auth0UserInfo) {
      throw new Error('Auth0 authentication client not initialized')
    }

    try {
      // Use Auth0's Resource Owner Password grant for direct authentication
      const { data } = await auth0Authentication.oauth.passwordGrant({
        username: email,
        password: password,
        realm: 'Username-Password-Authentication',
        audience: process.env.AUTH0_AUDIENCE || AUTH0_CONFIG.audience, // Use environment variable or config
        scope: 'openid profile email offline_access',
      });

      const { access_token, refresh_token, expires_in } = data;
      // Get user info
      const { data: userResponse } = await auth0UserInfo.getUserInfo(access_token);

      // Log security event
      await logSecurityEvent(SecurityEventType.LOGIN, {
        userId: userResponse.sub, // Auth0 v5 uses 'sub' for user ID in user info
        email: userResponse.email,
        method: 'password'
      })

      return {
        user: {
          id: userResponse.sub,
          email: userResponse.email,
          emailVerified: userResponse.email_verified,
          role: this.extractRoleFromUser(userResponse),
          fullName: userResponse.name,
          avatarUrl: userResponse.picture,
          createdAt: userResponse.created_at,
          lastLogin: userResponse.updated_at, // Auth0 v5 user info might not have last_login directly
          appMetadata: userResponse['https://pixelatedempathy.com/app_metadata'], // Custom namespace
          userMetadata: userResponse['https://pixelatedempathy.com/user_metadata'] // Custom namespace
        },
        token: access_token,
        refreshToken: refresh_token,
        expiresIn: expires_in,
      }
    } catch (error) {
      console.error('Auth0 sign in error:', error)
      throw new Error('Invalid credentials')
    }
  }

  /**
   * Create a new user
   * @param email User email
   * @param password User password
   * @param role User role
   * @returns Created user
   */
  async createUser(email: string, password: string, role: string = 'user') {
    if (!auth0Management) {
      throw new Error('Auth0 management client not initialized')
    }

    try {
      // Create user in Auth0
      const auth0User = await auth0Management.users.create({
        connection: 'Username-Password-Authentication',
        email,
        password,
        email_verified: false,
        verify_email: true,
        app_metadata: {
          roles: [this.mapRoleToAuth0Role(role)],
          imported_from: 'manual_creation'
        },
        user_metadata: {
          role,
          created_at: new Date().toISOString()
        }
      });

      return {
        id: auth0User.user_id,
        email: auth0User.email,
        emailVerified: auth0User.email_verified,
        role,
        fullName: auth0User.name,
        avatarUrl: auth0User.picture,
        createdAt: auth0User.created_at,
        appMetadata: auth0User.app_metadata,
        userMetadata: auth0User.user_metadata
      }
    } catch (error) {
      console.error('Auth0 create user error:', error)
      throw new Error('Failed to create user')
    }
  }

  /**
   * Get user by ID
   * @param userId Auth0 user ID
   * @returns User object or null
   */
  async getUserById(userId: string) {
    if (!auth0Management) {
      throw new Error('Auth0 management client not initialized')
    }

    try {
      const auth0User = await auth0Management.users.get(userId);

      return {
        id: auth0User.user_id,
        email: auth0User.email,
        emailVerified: auth0User.email_verified,
        role: this.extractRoleFromUser(auth0User),
        fullName: auth0User.name,
        avatarUrl: auth0User.picture,
        createdAt: auth0User.created_at,
        lastLogin: auth0User.last_login,
        appMetadata: auth0User.app_metadata,
        userMetadata: auth0User.user_metadata
      }
    } catch (error) {
      console.error('Auth0 get user error:', error)
      return null
    }
  }

  /**
   * Get all users (admin only)
   * @returns Array of user objects
   */
  async getAllUsers(): Promise<any[]> {
    if (!auth0Management) {
      throw new Error('Auth0 management client not initialized')
    }

    try {
      const { data: users } = await auth0Management.users.list();
      return users.map(user => ({
        id: user.user_id,
        email: user.email,
        emailVerified: user.email_verified,
        role: this.extractRoleFromUser(user),
        fullName: user.name,
        avatarUrl: user.picture,
        createdAt: user.created_at,
        lastLogin: user.last_login,
        appMetadata: user.app_metadata,
        userMetadata: user.user_metadata
      }))
    } catch (error) {
      console.error('Auth0 get all users error:', error)
      return []
    }
  }

  /**
   * Find user by email
   * @param email User email
   * @returns User object or null
   */
  async findUserByEmail(email: string) {
    if (!auth0Management) {
      throw new Error('Auth0 management client not initialized')
    }

    try {
      const { data: users } = await auth0Management.users.list({
        q: `email:"${email}"`,
        search_engine: 'v3'
      })

      if (users.length === 0) {
        return null
      }

      const auth0User = users[0]

      return {
        id: auth0User.user_id,
        email: auth0User.email,
        emailVerified: auth0User.email_verified,
        role: this.extractRoleFromUser(auth0User),
        fullName: auth0User.name,
        avatarUrl: auth0User.picture,
        createdAt: auth0User.created_at,
        lastLogin: auth0User.last_login,
        appMetadata: auth0User.app_metadata,
        userMetadata: auth0User.user_metadata
      }
    } catch (error) {
      console.error('Auth0 find user error:', error)
      return null
    }
  }

  /**
   * Update user profile
   * @param userId Auth0 user ID
   * @param updates User profile updates
   * @returns Updated user object or null
   */
  async updateUser(userId: string, updates: Record<string, unknown>) {
    if (!auth0Management) {
      throw new Error('Auth0 management client not initialized')
    }

    try {
      // Separate metadata updates
      const userUpdates: Record<string, unknown> = {}
      const userMetadataUpdates: Record<string, unknown> = {}
      const appMetadataUpdates: Record<string, unknown> = {}

      // Map fields to appropriate update objects
      for (const [key, value] of Object.entries(updates)) {
        switch (key) {
          case 'email':
          case 'email_verified':
          case 'blocked':
            userUpdates[key] = value
            break
          case 'role':
            // Update both user_metadata and app_metadata for role
            userMetadataUpdates.role = value
            if (typeof value === 'string') {
              appMetadataUpdates.roles = [this.mapRoleToAuth0Role(value)]
            }
            break
          default:
            // Add to user_metadata by default
            userMetadataUpdates[key] = value
            break
        }
      }

      // Update user in Auth0
      const updateParams: any = {}

      if (Object.keys(userUpdates).length > 0) {
        Object.assign(updateParams, userUpdates)
      }

      if (Object.keys(userMetadataUpdates).length > 0) {
        updateParams.user_metadata = userMetadataUpdates
      }

      if (Object.keys(appMetadataUpdates).length > 0) {
        updateParams.app_metadata = appMetadataUpdates
      }

      const auth0User = await auth0Management.users.update(
        userId,
        updateParams
      )

      return {
        id: auth0User.user_id,
        email: auth0User.email,
        emailVerified: auth0User.email_verified,
        role: this.extractRoleFromUser(auth0User),
        fullName: auth0User.name,
        avatarUrl: auth0User.picture,
        createdAt: auth0User.created_at,
        lastLogin: auth0User.last_login,
        appMetadata: auth0User.app_metadata,
        userMetadata: auth0User.user_metadata
      }
    } catch (error) {
      console.error('Auth0 update user error:', error)
      return null
    }
  }

  /**
   * Assign a role to a user
   * @param userId Auth0 user id
   * @param role Internal role name
   */
  async assignRoleToUser(userId: string, role: string) {
    if (!auth0Management) {
      throw new Error('Auth0 management client not initialized')
    }

    try {
      // Get role ID from name (this is a simplification, in reality we'd need to look up the ID)
      // For now, we'll assume the role exists and we map it to its expected name/ID
      const auth0RoleName = this.mapRoleToAuth0Role(role)

      // Get all roles to find the ID
      const { data: roles } = await auth0Management.roles.list()
      const targetRole = roles.find(r => r.name === auth0RoleName)

      if (!targetRole || !targetRole.id) {
        throw new Error(`Role ${auth0RoleName} not found in Auth0`)
      }

      await auth0Management.users.roles.assign(
        userId,
        { roles: [targetRole.id] }
      )

      // Also update app_metadata for consistency
      await this.updateUser(userId, { role })

      // Log success
      await logSecurityEvent(SecurityEventType.ROLE_ASSIGNED, {
        userId,
        role,
        auth0RoleId: targetRole.id
      })
    } catch (error) {
      console.error('Auth0 assign role error:', error)
      throw new Error(`Failed to assign role ${role} to user ${userId}`)
    }
  }

  /**
   * Change user password
   * @param userId Auth0 user ID
   * @param newPassword New password
   */
  async changePassword(userId: string, newPassword: string) {
    if (!auth0Management) {
      throw new Error('Auth0 management client not initialized')
    }

    try {
      await auth0Management.users.update(
        userId,
        { password: newPassword }
      )
    } catch (error) {
      console.error('Auth0 change password error:', error)
      throw new Error('Failed to change password')
    }
  }

  /**
   * Sign out user (invalidate refresh token)
   * @param refreshToken Refresh token to invalidate
   */
  async signOut(refreshToken: string) {
    if (!auth0Authentication) {
      throw new Error('Auth0 authentication client not initialized')
    }

    try {
      // Revoke refresh token
      await auth0Authentication.oauth.revokeRefreshToken({
        token: refreshToken
      })
    } catch (error) {
      console.error('Auth0 sign out error:', error)
      // Don't throw error for sign out - it's not critical
    }
  }

  /**
   * Refresh user session
   * @param refreshToken Refresh token
   * @returns New access token and user info
   */
  async refreshSession(refreshToken: string) {
    if (!auth0Authentication || !auth0UserInfo) {
      throw new Error('Auth0 authentication client not initialized')
    }

    try {
      // Exchange refresh token for new access token
      const { data } = await auth0Authentication.oauth.refreshTokenGrant({ refresh_token: refreshToken });

      const { access_token, expires_in } = data;

      // Get user info
      const { data: userResponse } = await auth0UserInfo.getUserInfo(access_token);

      return {
        user: {
          id: userResponse.sub,
          email: userResponse.email,
          emailVerified: userResponse.email_verified,
          role: this.extractRoleFromUser(userResponse),
          fullName: userResponse.name,
          avatarUrl: userResponse.picture,
          createdAt: userResponse.created_at,
          lastLogin: userResponse.updated_at,
          appMetadata: userResponse['https://pixelatedempathy.com/app_metadata'],
          userMetadata: userResponse['https://pixelatedempathy.com/user_metadata']
        },
        session: {
          accessToken: access_token,
          refreshToken: refreshToken, // Refresh token is not returned by refresh token grant, so we pass the original one
          expiresAt: new Date(Date.now() + expires_in * 1000)
        },
        accessToken: access_token
      }
    } catch (error) {
      console.error('Auth0 refresh session error:', error)
      throw new Error('Failed to refresh session')
    }
  }

  /**
   * Verify authentication token
   * @param token JWT token
   * @returns User info from token
   */
  async verifyAuthToken(token: string) {
    if (!auth0UserInfo) {
      throw new Error('Auth0 user info client not initialized')
    }

    try {
      // Decode token to get user info
      const { data: decodedToken } = await auth0UserInfo.getUserInfo(token);

      return {
        userId: decodedToken.sub,
        email: decodedToken.email,
        role: this.extractRoleFromUser(decodedToken)
      }
    } catch (error) {
      console.error('Auth0 verify token error:', error)
      throw new Error('Invalid token')
    }
  }

  /**
   * Create password reset ticket
   * @param userId Auth0 user ID
   * @param returnUrl Return URL after reset
   * @returns Password reset ticket URL
   */
  async createPasswordResetTicket(userId: string, returnUrl?: string) {
    if (!auth0Management) {
      throw new Error('Auth0 management client not initialized')
    }

    try {
      const ticket = await auth0Management.tickets.changePassword({
        user_id: userId,
        result_url: returnUrl,
        ttl_sec: 3600 // 1 hour
      })

      return ticket.ticket
    } catch (error) {
      console.error('Auth0 create password reset ticket error:', error)
      throw new Error('Failed to create password reset ticket')
    }
  }

  /**
   * Get available MFA factors for a user
   * @param userId Auth0 user ID
   * @returns Array of available factor types
   */
  async getAvailableMFAFactors(userId: string): Promise<string[]> {
    return await auth0MFAService.getAvailableFactors(userId)
  }

  /**
   * Start MFA enrollment process
   * @param userId Auth0 user ID
   * @param factor MFA enrollment details
   * @returns MFA challenge information
   */
  async startMFAEnrollment(userId: string, factor: MFAEnrollment): Promise<any> {
    return await auth0MFAService.startEnrollment(userId, factor)
  }

  /**
   * Complete MFA enrollment process
   * @param userId Auth0 user ID
   * @param verification MFA verification details
   * @returns Enrolled MFA factor
   */
  async completeMFAEnrollment(userId: string, verification: MFAVerification): Promise<MFAFactor> {
    return await auth0MFAService.completeEnrollment(userId, verification)
  }

  /**
   * Get user's enrolled MFA factors
   * @param userId Auth0 user ID
   * @returns Array of enrolled MFA factors
   */
  async getUserMFAFactors(userId: string): Promise<MFAFactor[]> {
    return await auth0MFAService.getUserFactors(userId)
  }

  /**
   * Delete/disable a user's MFA factor
   * @param userId Auth0 user ID
   * @param factorId MFA factor ID
   */
  async deleteMFAFactor(userId: string, factorId: string): Promise<void> {
    await auth0MFAService.deleteFactor(userId, factorId)
  }

  /**
   * Challenge user for MFA during authentication
   * @param userId Auth0 user ID
   * @param factorType Type of factor to challenge
   * @returns MFA challenge information
   */
  async challengeUserForMFA(userId: string, factorType: string): Promise<any> {
    return await auth0MFAService.challengeUser(userId, factorType)
  }

  /**
   * Verify MFA challenge response
   * @param userId Auth0 user ID
   * @param verification MFA verification details
   * @returns Whether verification was successful
   */
  async verifyMFAChallenge(userId: string, verification: MFAVerification): Promise<boolean> {
    return await auth0MFAService.verifyChallenge(userId, verification)
  }

  /**
   * Check if user has MFA enabled
   * @param userId Auth0 user ID
   * @returns Whether user has MFA enabled
   */
  async userHasMFA(userId: string): Promise<boolean> {
    return await auth0MFAService.userHasMFA(userId)
  }

  /**
   * Get user's preferred MFA factor
   * @param userId Auth0 user ID
   * @returns User's preferred MFA factor or null
   */
  async getUserPreferredMFAFactor(userId: string): Promise<MFAFactor | null> {
    return await auth0MFAService.getUserPreferredFactor(userId)
  }

  /**
   * Set user's preferred MFA factor
   * @param userId Auth0 user ID
   * @param factorId MFA factor ID
   */
  async setUserPreferredMFAFactor(userId: string, factorId: string): Promise<void> {
    await auth0MFAService.setUserPreferredFactor(userId, factorId)
  }

  /**
   * Get WebAuthn registration options for a new credential
   * @param registrationOptions WebAuthn registration options
   * @returns WebAuthn credential creation options
   */
  async getWebAuthnRegistrationOptions(registrationOptions: WebAuthnRegistrationOptions): Promise<any> {
    return await auth0WebAuthnService.getRegistrationOptions(registrationOptions)
  }

  /**
   * Verify and register a new WebAuthn credential
   * @param userId Auth0 user ID
   * @param credential WebAuthn credential data
   * @returns Registered WebAuthn credential
   */
  async verifyWebAuthnRegistration(userId: string, credential: any): Promise<WebAuthnCredential> {
    return await auth0WebAuthnService.verifyRegistration(userId, credential)
  }

  /**
   * Get WebAuthn authentication options for an existing user
   * @param authenticationOptions WebAuthn authentication options
   * @returns WebAuthn credential request options
   */
  async getWebAuthnAuthenticationOptions(authenticationOptions: WebAuthnAuthenticationOptions): Promise<any> {
    return await auth0WebAuthnService.getAuthenticationOptions(authenticationOptions)
  }

  /**
   * Verify WebAuthn authentication response
   * @param userId Auth0 user ID
   * @param credential WebAuthn credential response
   * @returns Whether authentication was successful
   */
  async verifyWebAuthnAuthentication(userId: string, credential: any): Promise<boolean> {
    return await auth0WebAuthnService.verifyAuthentication(userId, credential)
  }

  /**
   * Get user's WebAuthn credentials
   * @param userId Auth0 user ID
   * @returns Array of WebAuthn credentials
   */
  async getUserWebAuthnCredentials(userId: string): Promise<WebAuthnCredential[]> {
    return await auth0WebAuthnService.getUserWebAuthnCredentials(userId)
  }

  /**
   * Delete a WebAuthn credential
   * @param userId Auth0 user ID
   * @param credentialId WebAuthn credential ID
   */
  async deleteWebAuthnCredential(userId: string, credentialId: string): Promise<void> {
    await auth0WebAuthnService.deleteCredential(userId, credentialId)
  }

  /**
   * Rename a WebAuthn credential
   * @param userId Auth0 user ID
   * @param credentialId WebAuthn credential ID
   * @param newName New name for the credential
   */
  async renameWebAuthnCredential(userId: string, credentialId: string, newName: string): Promise<void> {
    await auth0WebAuthnService.renameCredential(userId, credentialId, newName)
  }

  /**
   * Check if user has any WebAuthn credentials
   * @param userId Auth0 user ID
   * @returns Whether user has WebAuthn credentials
   */
  async userHasWebAuthnCredentials(userId: string): Promise<boolean> {
    return await auth0WebAuthnService.userHasWebAuthnCredentials(userId)
  }

  /**
   * Get user's preferred WebAuthn credential
   * @param userId Auth0 user ID
   * @returns User's preferred WebAuthn credential or null
   */
  async getUserPreferredWebAuthnCredential(userId: string): Promise<WebAuthnCredential | null> {
    return await auth0WebAuthnService.getUserPreferredCredential(userId)
  }

  /**
   * Extract role from Auth0 user
   * @param user Auth0 user object
   * @returns User role
   */
  private extractRoleFromUser(user: any): string {
    // Try to get role from app_metadata first
    if (user.app_metadata?.roles?.length > 0) {
      const role = user.app_metadata.roles[0]
      return this.mapAuth0RoleToRole(role)
    }

    // Try user_metadata
    if (user.user_metadata?.role) {
      return user.user_metadata.role
    }

    // Default to user role
    return 'user'
  }

  /**
   * Map internal role to Auth0 role
   * @param role Internal role
   * @returns Auth0 role
   */
  private mapRoleToAuth0Role(role: string): string {
    switch (role) {
      case 'admin':
        return 'Admin'
      case 'therapist':
        return 'Therapist'
      case 'user':
      default:
        return 'User'
    }
  }

  /**
   * Map Auth0 role to internal role
   * @param auth0Role Auth0 role
   * @returns Internal role
   */
  private mapAuth0RoleToRole(auth0Role: string): string {
    switch (auth0Role) {
      case 'Admin':
        return 'admin'
      case 'Therapist':
        return 'therapist'
      case 'User':
      default:
        return 'user'
    }
  }
}

// Export singleton instance
export const auth0UserService = new Auth0UserService()

// Export individual functions for compatibility with existing adapter
export async function verifyToken(token: string) {
  return await auth0UserService.verifyAuthToken(token)
}

export async function getUserById(userId: string) {
  return await auth0UserService.getUserById(userId)
}

export async function createUser(opts: { email: string; password: string; role?: string }) {
  return await auth0UserService.createUser(opts.email, opts.password, opts.role ?? 'user')
}

export async function revokeToken(refreshToken: string) {
  await auth0UserService.signOut(refreshToken)
}

export async function revokeRefreshToken(refreshToken: string) {
  await auth0UserService.signOut(refreshToken)
}

export async function refreshToken(token: string) {
  return await auth0UserService.refreshSession(token)
}

export async function findUserByEmail(email: string) {
  return await auth0UserService.findUserByEmail(email)
}

export async function signIn(email: string, password: string) {
  return await auth0UserService.signIn(email, password)
}

export async function updateUser(userId: string, updates: Record<string, unknown>) {
  return await auth0UserService.updateUser(userId, updates)
}

// MFA functions
export async function getAvailableMFAFactors(userId: string) {
  return await auth0UserService.getAvailableMFAFactors(userId)
}

export async function startMFAEnrollment(userId: string, factor: any) {
  return await auth0UserService.startMFAEnrollment(userId, factor)
}

export async function completeMFAEnrollment(userId: string, verification: any) {
  return await auth0UserService.completeMFAEnrollment(userId, verification)
}

export async function getUserMFAFactors(userId: string) {
  return await auth0UserService.getUserMFAFactors(userId)
}

export async function deleteMFAFactor(userId: string, factorId: string) {
  return await auth0UserService.deleteMFAFactor(userId, factorId)
}

export async function challengeUserForMFA(userId: string, factorType: string) {
  return await auth0UserService.challengeUserForMFA(userId, factorType)
}

export async function verifyMFAChallenge(userId: string, verification: any) {
  return await auth0UserService.verifyMFAChallenge(userId, verification)
}

export async function userHasMFA(userId: string) {
  return await auth0UserService.userHasMFA(userId)
}

export async function getUserPreferredMFAFactor(userId: string) {
  return await auth0UserService.getUserPreferredMFAFactor(userId)
}

export async function setUserPreferredMFAFactor(userId: string, factorId: string) {
  return await auth0UserService.setUserPreferredMFAFactor(userId, factorId)
}

// WebAuthn functions
export async function getWebAuthnRegistrationOptions(registrationOptions: any) {
  return await auth0UserService.getWebAuthnRegistrationOptions(registrationOptions)
}

export async function verifyWebAuthnRegistration(userId: string, credential: any) {
  return await auth0UserService.verifyWebAuthnRegistration(userId, credential)
}

export async function getWebAuthnAuthenticationOptions(authenticationOptions: any) {
  return await auth0UserService.getWebAuthnAuthenticationOptions(authenticationOptions)
}

export async function verifyWebAuthnAuthentication(userId: string, credential: any) {
  return await auth0UserService.verifyWebAuthnAuthentication(userId, credential)
}

export async function getUserWebAuthnCredentials(userId: string) {
  return await auth0UserService.getUserWebAuthnCredentials(userId)
}

export async function deleteWebAuthnCredential(userId: string, credentialId: string) {
  return await auth0UserService.deleteWebAuthnCredential(userId, credentialId)
}

export async function renameWebAuthnCredential(userId: string, credentialId: string, newName: string) {
  return await auth0UserService.renameWebAuthnCredential(userId, credentialId, newName)
}

export async function userHasWebAuthnCredentials(userId: string) {
  return await auth0UserService.userHasWebAuthnCredentials(userId)
}

export async function getUserPreferredWebAuthnCredential(userId: string) {
  return await auth0UserService.getUserPreferredWebAuthnCredential(userId)
}

export async function getAllUsers() {
  return await auth0UserService.getAllUsers()
}

// Placeholder for OAuth verification (to be implemented)
export async function verifyOAuthCode(_code: string) {
  throw new Error('OAuth verification not implemented yet')
}

export default {
  verifyToken,
  getUserById,
  createUser,
  revokeToken,
  revokeRefreshToken,
  refreshToken,
  findUserByEmail,
  signIn,
  updateUser,
  getAvailableMFAFactors,
  startMFAEnrollment,
  completeMFAEnrollment,
  getUserMFAFactors,
  deleteMFAFactor,
  challengeUserForMFA,
  verifyMFAChallenge,
  userHasMFA,
  getUserPreferredMFAFactor,
  setUserPreferredMFAFactor,
  getWebAuthnRegistrationOptions,
  verifyWebAuthnRegistration,
  getWebAuthnAuthenticationOptions,
  verifyWebAuthnAuthentication,
  getUserWebAuthnCredentials,
  deleteWebAuthnCredential,
  renameWebAuthnCredential,
  userHasWebAuthnCredentials,
  getUserPreferredWebAuthnCredential,
  getAllUsers,
  verifyOAuthCode,
}