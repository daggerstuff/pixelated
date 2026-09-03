/**
 * Auth0 Service for Pixelated Empathy Platform
 *
 * This service provides authentication functionality using Auth0 instead of the
 * previous MongoDB-based authentication system.
 */

import { auth0MFAService } from '../auth/auth0-mfa-service'
import type {
  MFAFactor,
  MFAEnrollment,
  MFAChallenge,
  MFAVerification,
} from '../auth/auth0-mfa-service'
import { auth0WebAuthnService } from '../auth/auth0-webauthn-service'
import type {
  WebAuthnCredential,
  WebAuthnRegistrationOptions,
  WebAuthnAuthenticationOptions,
  WebAuthnCredentialCreationOptions,
  WebAuthnCredentialRequestOptions,
} from '../auth/auth0-webauthn-service'
import { logSecurityEvent, SecurityEventType } from '../security/index'
import type { AuthRole } from '../../config/auth.config'

import { initializeAuth0Clients, authLogger } from './auth0-service.utils'
import type { Auth0UserRecord, AuthenticatedUser, Auth0PasswordGrantResponse } from './auth0-service.utils'
export type { ManagementClientOptionsWithClientCredentials, AuthenticatedUser } from './auth0-service.utils'

/**
 * Auth0 User Service Class
 */
export class Auth0UserService {
  constructor() {
    // Initialize Auth0 clients
    initializeAuth0Clients()
  }

  /**
   * Sign in a user with email and password
   * @param email User email
   * @param password User password
   * @returns User and access token
   */
  async signIn(email: string, password: string) {
    if (!auth0Authentication) {
      throw new Error('Auth0 authentication client not initialized')
    }

    try {
      // Use Auth0's Resource Owner Password grant for direct authentication
      const response = await auth0Authentication.oauth.passwordGrant({
        username: email,
        password: password,
        realm: 'Username-Password-Authentication',
        scope: 'openid profile email',
        audience: process.env['AUTH0_AUDIENCE'] ?? '',
      })
      const tokenResponse = response.data as Auth0PasswordGrantResponse

      if (!auth0UserInfo) {
        throw new Error('Auth0 UserInfo client not initialized')
      }

      let userResponse: Auth0UserRecord
      try {
        // In v5, getUserInfo takes the access token
        const userInfoRes = await auth0UserInfo.getUserInfo(
          tokenResponse.access_token,
        )
        userResponse = this.parseAuth0UserRecord(userInfoRes.data)
        // normalized to match old structure expected below
        userResponse = {
          ...userResponse,
          user_id: userResponse.user_id ?? userResponse.sub,
        }
      } catch (e) {
        authLogger.warn(
          'Failed to fetch user info, falling back to token decode if possible or error',
          e,
        )
        throw e
      }

      // Log security event
      logSecurityEvent(SecurityEventType.LOGIN, null, {
        userId: this.toStringOrUndefined(userResponse.user_id),
        email: this.toStringOrUndefined(userResponse.email),
        method: 'password',
      })

      const authenticatedUser = this.toAuthenticatedUser(userResponse)
      return {
        user: authenticatedUser,
        token: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
      }
    } catch (error: unknown) {
      authLogger.error('Auth0 sign in error', error)
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
      const createRes = await auth0Management.users.create({
        email,
        password,
        connection: 'Username-Password-Authentication',
        email_verified: false,
        app_metadata: {
          roles: [this.mapRoleToAuth0Role(role)],
          imported_from: 'manual_creation',
        },
        user_metadata: {
          role,
          created_at: new Date().toISOString(),
        },
      })
      const auth0User = this.parseAuth0UserRecord(createRes.data)

      return this.toAuthenticatedUser(auth0User)
    } catch (error: unknown) {
      authLogger.error('Auth0 create user error', error)
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
      const getUserRes = await auth0Management.users.get({ id: userId })
      const auth0User = this.parseAuth0UserRecord(getUserRes.data)

      return this.toAuthenticatedUser(auth0User)
    } catch (error: unknown) {
      authLogger.error('Auth0 get user error', error)
      return null
    }
  }

  /**
   * Get all users (admin only)
   * @returns Array of user objects
   */
  async getAllUsers(): Promise<AuthenticatedUser[]> {
    if (!auth0Management) {
      throw new Error('Auth0 management client not initialized')
    }

    try {
      const usersPage = await auth0Management.users.list({})
      const users = this.parseAuth0UserList(usersPage.data)
      return users
        .map((user) => this.toAuthenticatedUser(user))
        .filter((user) => Boolean(user.id))
    } catch (error: unknown) {
      authLogger.error('Auth0 get all users error', error)
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
      const usersRes = await auth0Management.users.listUsersByEmail({
        email,
      })
      const users = this.parseAuth0UserList(usersRes)

      if (users.length === 0) {
        return null
      }

      const auth0User = users[0]
      if (!auth0User) {
        return null
      }
      return this.toAuthenticatedUser(auth0User)
    } catch (error: unknown) {
      authLogger.error('Auth0 find user error', error)
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
            userMetadataUpdates['role'] = value
            if (typeof value === 'string') {
              appMetadataUpdates['roles'] = [this.mapRoleToAuth0Role(value)]
            }
            break
          default:
            // Add to user_metadata by default
            userMetadataUpdates[key] = value
            break
        }
      }

      // Update user in Auth0
      const updateParams: Record<string, unknown> = {}

      if (Object.keys(userUpdates).length > 0) {
        Object.assign(updateParams, userUpdates)
      }

      if (Object.keys(userMetadataUpdates).length > 0) {
        updateParams['user_metadata'] = userMetadataUpdates
      }

      if (Object.keys(appMetadataUpdates).length > 0) {
        updateParams['app_metadata'] = appMetadataUpdates
      }

      const updateRes = await auth0Management.users.update(userId, updateParams)
      const auth0User = this.parseAuth0UserRecord(updateRes.data)

      return this.toAuthenticatedUser(auth0User)
    } catch (error: unknown) {
      authLogger.error('Auth0 update user error', error)
      return null
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
      await auth0Management.users.update(userId, { password: newPassword })
    } catch (error: unknown) {
      authLogger.error('Auth0 change password error', error)
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
        token: refreshToken,
      })
    } catch (error: unknown) {
      authLogger.error('Auth0 sign out error', error)
      // Don't throw error for sign out - it's not critical
    }
  }

  /**
   * Refresh user session
   * @param refreshToken Refresh token
   * @returns New access token and user info
   */
  async refreshSession(refreshToken: string) {
    if (!auth0Authentication) {
      throw new Error('Auth0 authentication client not initialized')
    }

    try {
      // Exchange refresh token for new access token
      const tokenRes = await auth0Authentication.oauth.refreshTokenGrant({
        refresh_token: refreshToken,
      })
      const tokenResponse = tokenRes.data as Auth0PasswordGrantResponse

      // Get user info
      if (!auth0UserInfo) {
        throw new Error('Auth0 UserInfo client not initialized')
      }
      const userInfoRes = await auth0UserInfo.getUserInfo(
        tokenResponse.access_token,
      )
      const userResponse = {
        ...this.parseAuth0UserRecord(userInfoRes.data),
        user_id: this.parseAuth0UserRecord(userInfoRes.data).sub,
      }
      const auth0User = this.toAuthenticatedUser(userResponse)
      const expiresIn =
        this.normalizeNumber(tokenResponse.expires_in, 3600) * 1000

      return {
        user: auth0User,
        session: {
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          expiresAt: new Date(Date.now() + expiresIn),
        },
        accessToken: tokenResponse.access_token,
      }
    } catch (error: unknown) {
      authLogger.error('Auth0 refresh session error', error)
      throw new Error('Failed to refresh session')
    }
  }

  /**
   * Verify authentication token
   * @param token JWT token
   * @returns User info from token
   */
  async verifyAuthToken(token: string) {
    if (!auth0Authentication) {
      throw new Error('Auth0 authentication client not initialized')
    }

    try {
      // Decode token to get user info
      if (!auth0UserInfo) {
        throw new Error('Auth0 UserInfo client not initialized')
      }
      const userInfoRes = await auth0UserInfo.getUserInfo(token)
      const userInfoData = this.parseAuth0UserRecord(userInfoRes.data)
      const decodedToken = {
        ...userInfoData,
        user_id: userInfoData.sub,
      }

      return {
        userId: this.toStringOrUndefined(decodedToken.user_id),
        email: this.toStringOrUndefined(decodedToken.email),
        role: this.extractRoleFromUser(decodedToken),
      }
    } catch (error: unknown) {
      authLogger.error('Auth0 verify token error', error)
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
      const ticketRes = await auth0Management.tickets.changePassword({
        user_id: userId,
        result_url: returnUrl,
        ttl_sec: 3600, // 1 hour
      })
      const ticket = this.toRecord(ticketRes.data)
      return ticket
        ? (this.toStringOrUndefined(ticket['ticket']) ?? null)
        : null
    } catch (error: unknown) {
      authLogger.error('Auth0 create password reset ticket error', error)
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
  async startMFAEnrollment(
    userId: string,
    factor: MFAEnrollment,
  ): Promise<MFAChallenge> {
    return await auth0MFAService.startEnrollment(userId, factor)
  }

  /**
   * Complete MFA enrollment process
   * @param userId Auth0 user ID
   * @param verification MFA verification details
   * @returns Enrolled MFA factor
   */
  async completeMFAEnrollment(
    userId: string,
    verification: MFAVerification,
  ): Promise<MFAFactor> {
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
  async challengeUserForMFA(
    userId: string,
    factorType: string,
  ): Promise<MFAChallenge> {
    return await auth0MFAService.challengeUser(userId, factorType)
  }

  /**
   * Verify MFA challenge response
   * @param userId Auth0 user ID
   * @param verification MFA verification details
   * @returns Whether verification was successful
   */
  async verifyMFAChallenge(
    userId: string,
    verification: MFAVerification,
  ): Promise<boolean> {
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
  async setUserPreferredMFAFactor(
    userId: string,
    factorId: string,
  ): Promise<void> {
    await auth0MFAService.setUserPreferredFactor(userId, factorId)
  }

  /**
   * Get WebAuthn registration options for a new credential
   * @param registrationOptions WebAuthn registration options
   * @returns WebAuthn credential creation options
   */
  async getWebAuthnRegistrationOptions(
    registrationOptions: WebAuthnRegistrationOptions,
  ): Promise<WebAuthnCredentialCreationOptions> {
    return await auth0WebAuthnService.getRegistrationOptions(
      registrationOptions,
    )
  }

  /**
   * Verify and register a new WebAuthn credential
   * @param userId Auth0 user ID
   * @param credential WebAuthn credential data
   * @returns Registered WebAuthn credential
   */
  async verifyWebAuthnRegistration(
    userId: string,
    credential: Record<string, unknown>,
  ): Promise<WebAuthnCredential> {
    return await auth0WebAuthnService.verifyRegistration(userId, credential)
  }

  /**
   * Get WebAuthn authentication options for an existing user
   * @param authenticationOptions WebAuthn authentication options
   * @returns WebAuthn credential request options
   */
  async getWebAuthnAuthenticationOptions(
    authenticationOptions: WebAuthnAuthenticationOptions,
  ): Promise<WebAuthnCredentialRequestOptions> {
    return await auth0WebAuthnService.getAuthenticationOptions(
      authenticationOptions,
    )
  }

  /**
   * Verify WebAuthn authentication response
   * @param userId Auth0 user ID
   * @param credential WebAuthn credential response
   * @returns Whether authentication was successful
   */
  async verifyWebAuthnAuthentication(
    userId: string,
    credential: Record<string, unknown>,
  ): Promise<boolean> {
    return await auth0WebAuthnService.verifyAuthentication(userId, credential)
  }

  /**
   * Get user's WebAuthn credentials
   * @param userId Auth0 user ID
   * @returns Array of WebAuthn credentials
   */
  async getUserWebAuthnCredentials(
    userId: string,
  ): Promise<WebAuthnCredential[]> {
    return await auth0WebAuthnService.getUserWebAuthnCredentials(userId)
  }

  /**
   * Delete a WebAuthn credential
   * @param userId Auth0 user ID
   * @param credentialId WebAuthn credential ID
   */
  async deleteWebAuthnCredential(
    userId: string,
    credentialId: string,
  ): Promise<void> {
    await auth0WebAuthnService.deleteCredential(userId, credentialId)
  }

  /**
   * Rename a WebAuthn credential
   * @param userId Auth0 user ID
   * @param credentialId WebAuthn credential ID
   * @param newName New name for the credential
   */
  async renameWebAuthnCredential(
    userId: string,
    credentialId: string,
    newName: string,
  ): Promise<void> {
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
  async getUserPreferredWebAuthnCredential(
    userId: string,
  ): Promise<WebAuthnCredential | null> {
    return await auth0WebAuthnService.getUserPreferredCredential(userId)
  }

  /**
   * Extract role from Auth0 user
   * @param user Auth0 user object
   * @returns User role
   */
  private extractRoleFromUser(user: Auth0UserRecord): AuthRole {
    const appMetadata = this.toRecord(
      user.app_metadata ?? user['https://pixelated-empathy.com/app_metadata'],
    )
    const appMetadataRoles = appMetadata?.['roles']
    if (this.isStringArray(appMetadataRoles) && appMetadataRoles.length > 0) {
      const firstRole = appMetadataRoles[0]
      if (firstRole) {
        return this.mapAuth0RoleToRole(firstRole)
      }
    }

    const userMetadata = this.toRecord(
      user.user_metadata ?? user['https://pixelated-empathy.com/user_metadata'],
    )
    const metadataRole = this.toStringOrUndefined(userMetadata?.['role'])
    return this.normalizeRole(metadataRole)
  }

  private mapAuth0RoleToRole(auth0Role: string): AuthRole {
    switch (auth0Role) {
      case 'Admin':
        return 'admin'
      case 'Staff':
        return 'staff'
      case 'Therapist':
        return 'therapist'
      case 'User':
      default:
        return 'user'
    }
  }

  private normalizeRole(role: string | undefined): AuthRole {
    if (
      role === 'admin' ||
      role === 'staff' ||
      role === 'therapist' ||
      role === 'user' ||
      role === 'guest'
    ) {
      return role
    }

    return 'user'
  }

  private mapRoleToAuth0Role(role: string): string {
    switch (role) {
      case 'admin':
        return 'Admin'
      case 'staff':
        return 'Staff'
      case 'therapist':
        return 'Therapist'
      case 'guest':
      case 'user':
      default:
        return 'User'
    }
  }

  private toAuthenticatedUser(user: Auth0UserRecord): AuthenticatedUser {
    return {
      id: this.toStringOrUndefined(user.user_id ?? user.sub) ?? '',
      email: this.toStringOrUndefined(user.email) ?? '',
      emailVerified: this.toBoolean(user.email_verified),
      role: this.extractRoleFromUser(user),
      fullName: this.toStringOrUndefined(user.name),
      avatarUrl: this.toStringOrUndefined(user.picture),
      createdAt: this.toStringOrUndefined(user.created_at),
      lastLogin: this.toStringOrUndefined(user.last_login),
      appMetadata: this.toRecord(
        user.app_metadata ?? user['https://pixelated-empathy.com/app_metadata'],
      ),
      userMetadata: this.toRecord(
        user.user_metadata ??
          user['https://pixelated-empathy.com/user_metadata'],
      ),
    }
  }

  private isStringArray(value: unknown): value is string[] {
    return (
      Array.isArray(value) &&
      value.every((entry): entry is string => typeof entry === 'string')
    )
  }

  private toStringOrUndefined(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined
  }

  private toBoolean(value: unknown): boolean {
    return typeof value === 'boolean' ? value : false
  }

  private parseAuth0UserRecord(value: unknown): Auth0UserRecord {
    return this.toRecord(value) ?? {}
  }

  private parseAuth0UserList(value: unknown): Auth0UserRecord[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value.map((item) => this.parseAuth0UserRecord(item))
  }

  private toRecord(value: unknown): Record<string, unknown> | undefined {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const record: Record<string, unknown> = {}
      for (const [key, item] of Object.entries(value)) {
        record[key] = item
      }
      return record
    }
    return undefined
  }

  private normalizeNumber(value: unknown, fallback = 0): number {
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : fallback
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

export async function createUser(opts: {
  email: string
  password: string
  role?: string
}) {
  return await auth0UserService.createUser(
    opts.email,
    opts.password,
    opts.role ?? 'user',
  )
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

export async function updateUser(
  userId: string,
  updates: Record<string, unknown>,
) {
  return await auth0UserService.updateUser(userId, updates)
}

// MFA functions
export async function getAvailableMFAFactors(userId: string) {
  return await auth0UserService.getAvailableMFAFactors(userId)
}

export async function startMFAEnrollment(
  userId: string,
  factor: MFAEnrollment,
) {
  return await auth0UserService.startMFAEnrollment(userId, factor)
}

export async function completeMFAEnrollment(
  userId: string,
  verification: MFAVerification,
) {
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

export async function verifyMFAChallenge(
  userId: string,
  verification: MFAVerification,
) {
  return await auth0UserService.verifyMFAChallenge(userId, verification)
}

export async function userHasMFA(userId: string) {
  return await auth0UserService.userHasMFA(userId)
}

export async function getUserPreferredMFAFactor(userId: string) {
  return await auth0UserService.getUserPreferredMFAFactor(userId)
}

export async function setUserPreferredMFAFactor(
  userId: string,
  factorId: string,
) {
  return await auth0UserService.setUserPreferredMFAFactor(userId, factorId)
}

// WebAuthn functions
export async function getWebAuthnRegistrationOptions(
  registrationOptions: WebAuthnRegistrationOptions,
) {
  return await auth0UserService.getWebAuthnRegistrationOptions(
    registrationOptions,
  )
}

export async function verifyWebAuthnRegistration(
  userId: string,
  credential: Record<string, unknown>,
) {
  return await auth0UserService.verifyWebAuthnRegistration(userId, credential)
}

export async function getWebAuthnAuthenticationOptions(
  authenticationOptions: WebAuthnAuthenticationOptions,
) {
  return await auth0UserService.getWebAuthnAuthenticationOptions(
    authenticationOptions,
  )
}

export async function verifyWebAuthnAuthentication(
  userId: string,
  credential: Record<string, unknown>,
) {
  return await auth0UserService.verifyWebAuthnAuthentication(userId, credential)
}

export async function getUserWebAuthnCredentials(userId: string) {
  return await auth0UserService.getUserWebAuthnCredentials(userId)
}

export async function deleteWebAuthnCredential(
  userId: string,
  credentialId: string,
) {
  return await auth0UserService.deleteWebAuthnCredential(userId, credentialId)
}

export async function renameWebAuthnCredential(
  userId: string,
  credentialId: string,
  newName: string,
) {
  return await auth0UserService.renameWebAuthnCredential(
    userId,
    credentialId,
    newName,
  )
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
